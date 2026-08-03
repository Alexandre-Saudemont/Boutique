import 'server-only';
import {prisma} from '@/server/db';
import {getCart} from '@/server/services/cart';
import {getSettings} from '@/server/services/settings';
import {getModesLivraison} from '@/server/services/shipping';

/* Le tunnel de commande.

   Trois idées commandent tout ce fichier.

   **Rien n'est figé avant la commande.** Le panier relit les prix à chaque
   affichage ; c'est `creerCommande` qui les recopie dans `OrderItem` et
   `OrderAddress`. Un prix modifié demain, un produit archivé, une adresse
   corrigée : la facture d'aujourd'hui ne bouge pas. C'est une obligation
   comptable autant qu'une question de confiance.

   **Le total est recalculé côté serveur au dernier moment.** Ce que le
   navigateur a affiché ne compte pas — entre l'étape livraison et la
   validation, un prix a pu changer ou une pièce partir. Le montant débité est
   celui que ce fichier calcule, jamais celui qui remonte du formulaire.

   **Le stock n'est pas décrémenté ici.** Une commande naît en attente de
   paiement ; réserver le stock à ce moment-là laisserait chaque panier
   abandonné bloquer des pièces. C'est la confirmation de paiement — le webhook
   Stripe ou PayPal — qui décrémentera. */

/* Franchise en base de TVA (art. 293 B du CGI) : la micro-entreprise ne facture
   pas de TVA. On enregistre quand même le régime sur la commande, parce qu'un
   dépassement de seuil fera basculer les commandes suivantes en STANDARD — et
   les anciennes doivent rester lisibles telles qu'elles ont été émises. */
const TAUX_TVA_BP = 0;

/* Les modes de livraison proposés, avec le prix réellement appliqué à ce panier.

   La liste des tarifs vient du service livraison plutôt que d'une seconde
   requête écrite ici : deux lectures des mêmes tarifs finiraient par diverger,
   et la fiche produit annoncerait un mode que le tunnel ne propose pas. */
export async function getModesLivraisonPour(sousTotalCents) {
	const tarifs = await getModesLivraison();

	return tarifs.map((tarif) => {
		/* Le franco est porté par le tarif, pas par un réglage global : le
		   retrait à l'atelier est gratuit d'emblée, le relais et le domicile ont
		   chacun leur seuil. */
		const offert =
			typeof tarif.freeAboveCents === 'number' && sousTotalCents >= tarif.freeAboveCents;

		return {
			id: tarif.id,
			nom: tarif.name,
			transporteur: tarif.carrier,
			delai: tarif.estimatedDays,
			pointRelais: tarif.isRelayPoint,
			prixCents: offert ? 0 : tarif.priceCents,
			prixCatalogueCents: tarif.priceCents,
			offert,
		};
	});
}

/// Le mode choisi, revérifié en base. `null` si l'identifiant ne correspond à
/// aucun tarif actif — un choix venu du navigateur ne se croit pas sur parole.
export async function getModeLivraison(rateId, sousTotalCents) {
	if (!rateId) return null;

	const modes = await getModesLivraisonPour(sousTotalCents);
	return modes.find((mode) => mode.id === rateId) ?? null;
}

/* Vérifie une adresse de livraison.

   Volontairement minimal : nom, adresse, code postal, ville. Pas de contrôle du
   format de la voie ni de la cohérence code postal / ville — la France a trop
   d'exceptions pour qu'une regex ait raison, et un formulaire qui refuse une
   adresse valide coûte une vente. Le code postal se limite à cinq chiffres
   parce que la zone est la France métropolitaine. */
const CHAMPS_OBLIGATOIRES = {
	firstName: 'Le prénom est obligatoire.',
	lastName: 'Le nom est obligatoire.',
	line1: "L'adresse est obligatoire.",
	postalCode: 'Le code postal est obligatoire.',
	city: 'La ville est obligatoire.',
};

export function validerAdresse(donnees) {
	const erreurs = {};

	for (const [champ, message] of Object.entries(CHAMPS_OBLIGATOIRES)) {
		if (!String(donnees[champ] ?? '').trim()) erreurs[champ] = message;
	}

	if (donnees.postalCode && !/^\d{5}$/.test(String(donnees.postalCode).trim())) {
		erreurs.postalCode = 'Le code postal doit faire cinq chiffres.';
	}

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(donnees.email ?? '').trim())) {
		erreurs.email = 'Une adresse e-mail valide est nécessaire pour le suivi.';
	}

	return {valide: Object.keys(erreurs).length === 0, erreurs};
}

/* Le numéro de commande : AVGF-2026-000142.

   Lisible et prononçable au téléphone, contrairement à un cuid. Le compteur
   repart à chaque année civile — c'est ce qu'attend un livre de recettes.

   La séquence se déduit du dernier numéro de l'année plutôt que d'un compteur
   séparé : une commande supprimée ne décale pas la suite. Le calcul vit dans la
   transaction de création, ce qui écarte le cas de deux commandes simultanées
   qui tireraient le même numéro. */
async function prochainNumero(tx) {
	const annee = new Date().getFullYear();
	const prefixe = `AVGF-${annee}-`;

	const derniere = await tx.order.findFirst({
		where: {orderNumber: {startsWith: prefixe}},
		orderBy: {orderNumber: 'desc'},
		select: {orderNumber: true},
	});

	const rang = derniere ? Number(derniere.orderNumber.slice(prefixe.length)) + 1 : 1;

	return `${prefixe}${String(rang).padStart(6, '0')}`;
}

/* Crée la commande à partir du panier, de l'adresse et du mode de livraison.

   Tout se passe dans une transaction : une commande à moitié écrite — des
   lignes sans adresse, un panier vidé sans commande — serait pire qu'un échec
   franc. */
export async function creerCommande({token, adresse, rateId, note = null, provider = 'STRIPE'}) {
	const reglages = await getSettings();
	if (!reglages['shop.open']) {
		return {ok: false, erreur: "La boutique n'est pas encore ouverte."};
	}

	const panier = await getCart(token);
	if (panier.lignes.length === 0) {
		return {ok: false, erreur: 'Votre panier est vide.'};
	}

	const controle = validerAdresse(adresse);
	if (!controle.valide) {
		return {ok: false, erreur: 'Adresse incomplète.', erreurs: controle.erreurs};
	}

	const mode = await getModeLivraison(rateId, panier.sousTotalCents);
	if (!mode) {
		return {ok: false, erreur: 'Choisissez un mode de livraison.'};
	}

	const minimumCents = Number(reglages['order.minimumCents']) || 0;
	if (panier.sousTotalCents < minimumCents) {
		return {ok: false, erreur: 'Le montant minimum de commande n’est pas atteint.'};
	}

	/* Les lignes sont relues ici, avec leur produit et leur variante : le panier
	   affichable ne porte pas le SKU ni le type (physique / numérique), dont la
	   commande a besoin pour la préparation et les téléchargements. */
	const lignes = await prisma.cartItem.findMany({
		where: {cart: {sessionToken: token}},
		include: {variant: {include: {product: true}}},
	});

	if (lignes.length === 0) {
		return {ok: false, erreur: 'Votre panier est vide.'};
	}

	const articles = lignes.map((ligne) => {
		const {variant} = ligne;

		return {
			variantId: variant.id,
			productName: variant.product.name,
			variantName: variant.name,
			sku: variant.sku,
			kind: variant.product.kind,
			unitPriceCents: variant.priceCents,
			vatRateBp: TAUX_TVA_BP,
			quantity: ligne.quantity,
			totalCents: variant.priceCents * ligne.quantity,
		};
	});

	const sousTotalCents = articles.reduce((somme, article) => somme + article.totalCents, 0);
	const totalCents = sousTotalCents + mode.prixCents;

	const commande = await prisma.$transaction(async (tx) => {
		const creee = await tx.order.create({
			data: {
				orderNumber: await prochainNumero(tx),
				email: String(adresse.email).trim().toLowerCase(),
				phone: adresse.phone ? String(adresse.phone).trim() : null,
				status: 'PENDING_PAYMENT',
				vatRegime: reglages['vat.regime'] === 'STANDARD' ? 'STANDARD' : 'FRANCHISE',
				subtotalCents: sousTotalCents,
				shippingCents: mode.prixCents,
				vatCents: 0,
				totalCents,
				customerNote: note,
				carrier: mode.transporteur,
				shippingMethod: mode.nom,
				placedAt: new Date(),
				items: {create: articles},
				/* Le paiement est créé en attente dès la commande : c'est lui que le
				   webhook du prestataire viendra retrouver pour la passer en payée.
				   `providerPaymentId` restera nul jusqu'à ce que Stripe ou PayPal
				   nous renvoie le sien. */
				payments: {
					create: {
						provider: provider === 'PAYPAL' ? 'PAYPAL' : 'STRIPE',
						status: 'PENDING',
						amountCents: totalCents,
					},
				},
				addresses: {
					create: {
						type: 'SHIPPING',
						firstName: String(adresse.firstName).trim(),
						lastName: String(adresse.lastName).trim(),
						line1: String(adresse.line1).trim(),
						line2: adresse.line2 ? String(adresse.line2).trim() : null,
						postalCode: String(adresse.postalCode).trim(),
						city: String(adresse.city).trim(),
						country: 'FR',
						phone: adresse.phone ? String(adresse.phone).trim() : null,
					},
				},
			},
		});

		/* Le panier est vidé, pas supprimé : le visiteur garde son jeton et son
		   prochain ajout retombe sur le même panier. */
		await tx.cartItem.deleteMany({where: {cart: {sessionToken: token}}});

		return creee;
	});

	return {ok: true, numero: commande.orderNumber, id: commande.id};
}

/* Une commande, par son numéro.

   L'e-mail est exigé en second facteur : un numéro de commande est court et se
   devine, il ne peut pas suffire à ouvrir la facture de quelqu'un d'autre.
   L'écran de confirmation, lui, arrive juste après la création et sait déjà les
   deux. */
export async function getCommande(numero, email) {
	if (!numero || !email) return null;

	return prisma.order.findFirst({
		where: {orderNumber: numero, email: String(email).trim().toLowerCase()},
		include: {items: true, addresses: true},
	});
}
