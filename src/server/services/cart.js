import 'server-only';
import {prisma} from '@/server/db';
import {getSettings} from '@/server/services/settings';
import {etatProduit} from '@/server/services/products';
import {appliquerCodeAuPanier} from '@/server/services/discounts';

/* Le panier.

   Un panier appartient soit à un compte (`userId`), soit à un visiteur anonyme
   identifié par un jeton en cookie (`sessionToken`). Tant que les comptes
   n'existent pas, seul le second cas se produit ; le jour où ils arriveront, il
   faudra fusionner le panier invité dans celui du compte à la connexion.

   Une ligne référence une **variante**, pas un produit : c'est elle qui porte le
   prix, le stock et le poids. Et elle ne fige rien — le prix affiché est relu à
   chaque affichage. C'est la commande qui recopiera les montants, pas le panier :
   un panier abandonné trois semaines ne doit pas ressusciter un vieux prix.

   Les quantités sont bornées côté serveur et pas seulement dans l'interface :
   un `+` cliqué cent fois, ou une action rejouée à la main, ne doit pas réserver
   tout le stock. */

const QUANTITE_MAX = 9;

/* Un panier invité ne vit pas éternellement : sans expiration, la table enfle
   d'un panier par visiteur qui a cliqué une fois. Trente jours laissent le
   temps de revenir finir ses achats. */
const DUREE_VIE_JOURS = 30;

function dateExpiration() {
	const date = new Date();
	date.setDate(date.getDate() + DUREE_VIE_JOURS);
	return date;
}

const PANIER_VIDE = {
	lignes: [],
	nombreArticles: 0,
	sousTotalCents: 0,
	reductionCents: 0,
	totalApresReductionCents: 0,
	promo: null,
	franco: {seuilCents: 0, atteint: false, resteCents: 0},
};

/* Ce qu'il faut charger pour afficher une ligne : le nom et l'image viennent du
   produit, le prix et le stock de la variante, les options du libellé
   (« Taille M »). */
const INCLUSION_LIGNE = {
	variant: {
		include: {
			options: {select: {name: true, value: true}},
			product: {
				include: {
					primaryCategory: {select: {name: true, slug: true}},
					images: {orderBy: {position: 'asc'}, take: 1, select: {url: true, alt: true}},
				},
			},
		},
	},
};

/// Le stock encore disponible sur une variante — `Infinity` si la vente à
/// découvert est autorisée (précommande, réassort permanent).
function disponible(variante) {
	return variante.allowBackorder ? Infinity : Math.max(0, variante.stock);
}

/// Met une ligne brute de Prisma en forme pour l'affichage.
function ligneAffichable(ligne) {
	const {variant} = ligne;
	const produit = variant.product;

	return {
		id: ligne.id,
		varianteId: variant.id,
		nom: produit.name,
		slug: produit.slug,
		rayon: produit.primaryCategory?.name ?? null,
		etat: etatProduit(produit),
		// Le nom de la variante n'a de sens que s'il y en a plusieurs : sur un
		// produit à variante unique, il répète le nom du produit.
		variante: variant.options.map((option) => option.value).join(' · ') || null,
		image: produit.images[0] ?? null,
		prixCents: variant.priceCents,
		quantite: ligne.quantity,
		totalLigneCents: variant.priceCents * ligne.quantity,
		maximum: Math.min(QUANTITE_MAX, disponible(variant)),
	};
}

/* Assemble le panier affichable à partir de ses lignes.

   Le franco de port est calculé ici plutôt que dans la page : c'est le même
   calcul pour le récapitulatif du panier, celui du tunnel et l'indice
   « plus que X € ». Le dupliquer, c'est le voir diverger. */
async function pourAffichage(lignes, codePromo = null) {
	const reglages = await getSettings();
	const seuilCents = Number(reglages['shipping.freeAboveCents']) || 0;

	const affichables = lignes.map(ligneAffichable);
	const sousTotalCents = affichables.reduce(
		(somme, ligne) => somme + ligne.totalLigneCents,
		0,
	);

	/* Le code est revérifié à chaque affichage plutôt que cru sur parole : il a
	   pu expirer, être désactivé ou atteindre son quota depuis qu'il a été saisi.
	   Un code devenu invalide disparaît simplement du récapitulatif. */
	const promo =
		codePromo && sousTotalCents > 0
			? await appliquerCodeAuPanier(codePromo, sousTotalCents)
			: null;

	const reductionCents = promo?.ok ? promo.reductionCents : 0;

	/* **Le franco se juge sur ce que le client paie réellement**, donc après
	   réduction. Décision du client : un code de 10 € sur un panier de 55 € le
	   fait retomber à 45 €, et la livraison redevient payante. */
	const baseFrancoCents = sousTotalCents - reductionCents;

	return {
		lignes: affichables,
		nombreArticles: affichables.reduce((somme, ligne) => somme + ligne.quantite, 0),
		sousTotalCents,
		reductionCents,
		totalApresReductionCents: baseFrancoCents,
		promo: promo?.ok
			? {
					code: promo.code,
					description: promo.description,
					livraisonOfferte: promo.livraisonOfferte,
				}
			: null,
		franco: {
			seuilCents,
			// La livraison offerte par un code court-circuite le seuil.
			atteint:
				Boolean(promo?.ok && promo.livraisonOfferte) ||
				(seuilCents > 0 && baseFrancoCents >= seuilCents),
			resteCents: Math.max(0, seuilCents - baseFrancoCents),
		},
	};
}

/* Le panier d'un visiteur, ou un panier vide s'il n'en a pas encore.

   Lecture seule : afficher une page ne doit jamais créer de ligne en base.
   Sinon le moindre robot qui passe sur /panier laisse un panier derrière lui. */
export async function getCart(token, codePromo = null) {
	if (!token) return PANIER_VIDE;

	const panier = await prisma.cart.findUnique({
		where: {sessionToken: token},
		include: {items: {orderBy: {addedAt: 'asc'}, include: INCLUSION_LIGNE}},
	});

	if (!panier) return PANIER_VIDE;

	return pourAffichage(panier.items, codePromo);
}

/// Le nombre d'articles, pour la pastille du header. Un count plutôt que le
/// panier entier : le header s'affiche sur toutes les pages du site.
export async function countCartItems(token) {
	if (!token) return 0;

	const total = await prisma.cartItem.aggregate({
		where: {cart: {sessionToken: token}},
		_sum: {quantity: true},
	});

	return total._sum.quantity ?? 0;
}

/* Ajoute une variante au panier, en créant le panier au besoin.

   Toutes les vérifications sont refaites ici, même celles que l'interface
   applique déjà : la boutique est-elle ouverte, la variante est-elle en vente,
   le stock suit-il. Une action serveur est une porte publique — le bouton
   désactivé à l'écran n'empêche personne de l'appeler. */
export async function addItem(token, varianteId, quantite = 1) {
	const reglages = await getSettings();
	if (!reglages['shop.open']) {
		return {ok: false, erreur: "La boutique n'est pas encore ouverte."};
	}

	const demandee = Math.max(1, Math.min(QUANTITE_MAX, Math.trunc(Number(quantite) || 1)));

	const variante = await prisma.productVariant.findFirst({
		where: {
			id: varianteId,
			isActive: true,
			archivedAt: null,
			product: {isActive: true, archivedAt: null, publishedAt: {not: null, lte: new Date()}},
		},
	});

	if (!variante) {
		return {ok: false, erreur: "Cette pièce n'est plus disponible."};
	}

	const panier = await prisma.cart.upsert({
		where: {sessionToken: token},
		update: {expiresAt: dateExpiration()},
		create: {sessionToken: token, expiresAt: dateExpiration()},
	});

	const existante = await prisma.cartItem.findUnique({
		where: {cartId_variantId: {cartId: panier.id, variantId: varianteId}},
	});

	/* La quantité demandée s'ajoute à celle déjà au panier — sinon deux ajouts
	   de 3 donneraient 3, et le visiteur croirait avoir perdu son premier clic. */
	const voulue = (existante?.quantity ?? 0) + demandee;
	const plafond = Math.min(QUANTITE_MAX, disponible(variante));

	if (plafond <= 0) {
		return {ok: false, erreur: 'Cette pièce est en rupture.'};
	}

	const retenue = Math.min(voulue, plafond);

	await prisma.cartItem.upsert({
		where: {cartId_variantId: {cartId: panier.id, variantId: varianteId}},
		update: {quantity: retenue},
		create: {cartId: panier.id, variantId: varianteId, quantity: retenue},
	});

	// Le plafond atteint n'est pas une erreur : la pièce est bien au panier,
	// simplement pas dans la quantité voulue. À l'interface de le dire.
	return {ok: true, quantite: retenue, plafonne: retenue < voulue};
}

/* Change la quantité d'une ligne. Zéro retire la ligne — c'est ce qu'attend le
   visiteur qui clique « − » sur une quantité de 1. */
export async function setQuantity(token, ligneId, quantite) {
	if (!token) return {ok: false, erreur: 'Panier introuvable.'};

	const ligne = await prisma.cartItem.findFirst({
		where: {id: ligneId, cart: {sessionToken: token}},
		include: {variant: true},
	});

	if (!ligne) return {ok: false, erreur: 'Cette ligne n’est plus au panier.'};

	const voulue = Math.trunc(Number(quantite) || 0);

	if (voulue <= 0) {
		await prisma.cartItem.delete({where: {id: ligne.id}});
		return {ok: true, retiree: true};
	}

	const plafond = Math.max(1, Math.min(QUANTITE_MAX, disponible(ligne.variant)));
	const retenue = Math.min(voulue, plafond);

	await prisma.cartItem.update({where: {id: ligne.id}, data: {quantity: retenue}});

	return {ok: true, quantite: retenue, plafonne: retenue < voulue};
}

/* Retire une ligne.

   Le `cart: {sessionToken}` de la clause n'est pas décoratif : sans lui,
   n'importe qui pourrait vider le panier d'un autre en devinant un identifiant
   de ligne. */
export async function removeItem(token, ligneId) {
	if (!token) return {ok: false};

	const supprimees = await prisma.cartItem.deleteMany({
		where: {id: ligneId, cart: {sessionToken: token}},
	});

	return {ok: supprimees.count > 0};
}
