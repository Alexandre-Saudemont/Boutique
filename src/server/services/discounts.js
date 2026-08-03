import 'server-only';
import {prisma} from '@/server/db';

/* Codes de réduction.

   **Le franco de port se calcule après réduction** — décision du client. Un
   panier à 55 € avec un code de 10 € tombe à 45 € : la livraison redevient
   payante. Autrement dit, on regarde ce que l'acheteur paie réellement, jamais
   ce qu'il aurait payé sans le code. Cette règle vit à un seul endroit,
   `appliquerCodeAuPanier`, précisément pour ne pas être réinventée
   différemment dans le tunnel.

   Trois natures de code, et elles ne se cumulent pas entre elles : un
   pourcentage, un montant fixe, ou la livraison offerte. Un seul code par
   commande — cumuler deux réductions est le meilleur moyen de vendre à perte
   sans s'en apercevoir.

   Le compteur d'utilisations (`usedCount`) n'est incrémenté qu'à la création de
   la commande, pas à la saisie du code : sinon un visiteur qui teste un code
   puis abandonne consommerait une utilisation. */

export const LIBELLES_TYPE = {
	PERCENT: 'Pourcentage',
	FIXED: 'Montant fixe',
	FREE_SHIPPING: 'Livraison offerte',
};

/* Cherche un code et dit s'il est utilisable maintenant, sur ce panier.

   Les messages distinguent les causes de refus — expiré, montant insuffisant,
   épuisé — parce qu'un « code invalide » unique laisse l'acheteur croire qu'il
   a mal tapé, et abandonner alors qu'il lui manquait trois euros. Aucune de ces
   informations n'est sensible : elles figurent dans l'offre elle-même. */
export async function verifierCode(code, sousTotalCents) {
	const saisi = String(code ?? '')
		.trim()
		.toUpperCase();

	if (!saisi) return {ok: false, erreur: 'Saisissez un code.'};

	const promo = await prisma.discountCode.findUnique({where: {code: saisi}});

	if (!promo || !promo.isActive) {
		return {ok: false, erreur: 'Ce code n’existe pas ou n’est plus actif.'};
	}

	const maintenant = new Date();

	if (promo.startsAt && promo.startsAt > maintenant) {
		return {ok: false, erreur: 'Ce code n’est pas encore valable.'};
	}

	if (promo.endsAt && promo.endsAt < maintenant) {
		return {ok: false, erreur: 'Ce code a expiré.'};
	}

	if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
		return {ok: false, erreur: 'Ce code a déjà été utilisé au maximum.'};
	}

	if (promo.minSubtotalCents && sousTotalCents < promo.minSubtotalCents) {
		return {
			ok: false,
			erreur: `Ce code s’applique à partir de ${(promo.minSubtotalCents / 100)
				.toFixed(2)
				.replace('.', ',')} € d’achat.`,
		};
	}

	return {ok: true, promo};
}

/* Calcule la réduction pour un sous-total donné.

   La réduction ne dépasse jamais le sous-total : un code de 20 € sur un panier
   de 15 € ramène à zéro, il ne crée pas d'avoir. Sans cette borne, un total
   négatif remonterait jusqu'au paiement.

   La livraison offerte ne touche pas au sous-total : elle agit sur les frais de
   port, calculés ailleurs. */
export function calculerReduction(promo, sousTotalCents) {
	if (!promo) return {reductionCents: 0, livraisonOfferte: false};

	if (promo.type === 'FREE_SHIPPING') {
		return {reductionCents: 0, livraisonOfferte: true};
	}

	if (promo.type === 'PERCENT') {
		// Points de base : 1500 = 15 %. Arrondi au centime inférieur, en faveur
		// de la boutique — un arrondi supérieur ferait perdre un centime par
		// commande, ce qui finit par se voir en comptabilité.
		const reduction = Math.floor((sousTotalCents * (promo.percentBp ?? 0)) / 10000);
		return {reductionCents: Math.min(reduction, sousTotalCents), livraisonOfferte: false};
	}

	return {
		reductionCents: Math.min(promo.amountCents ?? 0, sousTotalCents),
		livraisonOfferte: false,
	};
}

/* Ce que le code change pour ce panier : la réduction, et le montant sur lequel
   se juge le franco de port.

   C'est ici que vit la décision du client : `baseFrancoCents` est le sous-total
   **après** réduction. Le service de livraison compare son seuil à cette
   valeur, sans savoir qu'un code est passé par là. */
export async function appliquerCodeAuPanier(code, sousTotalCents) {
	const controle = await verifierCode(code, sousTotalCents);

	if (!controle.ok) return {ok: false, erreur: controle.erreur};

	const {reductionCents, livraisonOfferte} = calculerReduction(controle.promo, sousTotalCents);

	return {
		ok: true,
		code: controle.promo.code,
		description: controle.promo.description,
		reductionCents,
		livraisonOfferte,
		baseFrancoCents: sousTotalCents - reductionCents,
	};
}

/// Enregistre l'usage d'un code, à la création de la commande. Passe par la
/// transaction de la commande pour qu'un échec de celle-ci n'ait pas consommé
/// une utilisation.
export async function consommerCode(code, tx = prisma) {
	if (!code) return;

	await tx.discountCode.updateMany({
		where: {code},
		data: {usedCount: {increment: 1}},
	});
}

/* ── Back-office ──────────────────────────────────────────────────────────── */

export async function listerCodes() {
	return prisma.discountCode.findMany({orderBy: {createdAt: 'desc'}, take: 200});
}

export function validerCode(saisie) {
	const erreurs = {};

	const code = String(saisie.code ?? '')
		.trim()
		.toUpperCase();

	/* Lettres, chiffres et tirets seulement : un code se dicte au téléphone et
	   se tape à la main. Les espaces et les accents s'y perdent. */
	if (!/^[A-Z0-9-]{3,32}$/.test(code)) {
		erreurs.code = 'De 3 à 32 caractères : lettres, chiffres et tirets.';
	}

	if (!Object.hasOwn(LIBELLES_TYPE, saisie.type)) erreurs.type = 'Type inconnu.';

	if (saisie.type === 'PERCENT') {
		const pourcent = Number(String(saisie.valeur ?? '').replace(',', '.'));

		if (!Number.isFinite(pourcent) || pourcent <= 0 || pourcent > 100) {
			erreurs.valeur = 'Un pourcentage entre 1 et 100.';
		}
	}

	if (saisie.type === 'FIXED') {
		const texte = String(saisie.valeur ?? '')
			.replace(/\s/g, '')
			.replace(',', '.');

		if (!/^\d+(\.\d{1,2})?$/.test(texte) || Number(texte) <= 0) {
			erreurs.valeur = 'Un montant en euros (ex. 10,00).';
		}
	}

	if (saisie.debut && saisie.fin && new Date(saisie.debut) > new Date(saisie.fin)) {
		erreurs.fin = 'La fin ne peut pas précéder le début.';
	}

	return {valide: Object.keys(erreurs).length === 0, erreurs};
}

export async function enregistrerCode(saisie) {
	const controle = validerCode(saisie);
	if (!controle.valide) return {ok: false, erreurs: controle.erreurs};

	const code = String(saisie.code).trim().toUpperCase();

	const valeur = String(saisie.valeur ?? '')
		.replace(/\s/g, '')
		.replace(',', '.');

	const donnees = {
		code,
		description: String(saisie.description ?? '').trim() || null,
		type: saisie.type,
		// Un seul des deux champs est renseigné selon le type ; l'autre est remis
		// à null pour qu'un changement de type ne laisse pas traîner l'ancien.
		percentBp: saisie.type === 'PERCENT' ? Math.round(Number(valeur) * 100) : null,
		amountCents: saisie.type === 'FIXED' ? Math.round(Number(valeur) * 100) : null,
		minSubtotalCents: String(saisie.minimum ?? '').trim()
			? Math.round(Number(String(saisie.minimum).replace(',', '.')) * 100)
			: null,
		startsAt: saisie.debut ? new Date(saisie.debut) : null,
		endsAt: saisie.fin ? new Date(saisie.fin) : null,
		maxUses: String(saisie.maxUtilisations ?? '').trim()
			? Number(saisie.maxUtilisations)
			: null,
		isActive: Boolean(saisie.actif),
	};

	try {
		const enregistre = saisie.id
			? await prisma.discountCode.update({where: {id: saisie.id}, data: donnees})
			: await prisma.discountCode.create({data: donnees});

		return {ok: true, id: enregistre.id};
	} catch (erreur) {
		// Collision sur le code : deux promos ne peuvent pas porter le même nom,
		// sinon on ne saurait pas laquelle appliquer.
		if (erreur.code === 'P2002') {
			return {ok: false, erreurs: {code: 'Ce code existe déjà.'}};
		}

		throw erreur;
	}
}

/// Désactive un code sans le supprimer : des commandes passées en portent le
/// nom en copie, et le compteur d'utilisations reste une trace utile.
export async function basculerCode(id, actif) {
	await prisma.discountCode.update({where: {id}, data: {isActive: Boolean(actif)}});

	return {ok: true};
}
