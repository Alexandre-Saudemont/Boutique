import 'server-only';
import {prisma} from '@/server/db';
import {getSettings} from '@/server/services/settings';

/* Les avis clients.

   **La modération est préalable par défaut** (question 6 du questionnaire, et
   réglage `reviews.moderation`). Un avis déposé n'apparaît pas tout de suite :
   il attend d'être lu. C'est un peu de travail pour le client, et la certitude
   qu'il ne se réveillera jamais avec une insulte ou du spam affiché sur sa
   boutique — ce qui, une fois arrivé, se répare mal.

   **Seules les personnes connectées peuvent déposer un avis.** C'est un choix,
   et il a un coût : un acheteur invité ne peut pas s'exprimer sans créer un
   compte. En échange, on sait qui parle, on peut vérifier qu'il a acheté la
   pièce, et le formulaire n'est pas une porte ouverte au spam automatisé. Le
   tunnel de commande propose justement de créer un compte après l'achat.

   **La note moyenne est dénormalisée** sur le produit (`averageRating`,
   `reviewCount`) parce qu'elle s'affiche sur chaque carte de la boutique :
   la recalculer à chaque liste ferait une agrégation par produit affiché. Elle
   est donc recalculée à chaque changement de statut d'un avis — le seul moment
   où elle peut bouger. */

const NOTE_MIN = 1;
const NOTE_MAX = 5;

/* Recalcule la note moyenne et le nombre d'avis d'un produit.

   Ne compte que les avis approuvés : un avis en attente ne doit pas peser sur
   la note affichée, sans quoi la modération ne servirait à rien.

   La moyenne est arrondie au dixième — afficher 4,3333 donnerait une précision
   que trois avis ne justifient pas. */
async function recalculerNote(productId, tx = prisma) {
	const agregat = await tx.review.aggregate({
		where: {productId, status: 'APPROVED'},
		_avg: {rating: true},
		_count: true,
	});

	await tx.product.update({
		where: {id: productId},
		data: {
			averageRating:
				agregat._count > 0 ? Math.round(agregat._avg.rating * 10) / 10 : null,
			reviewCount: agregat._count,
		},
	});
}

/// Les avis visibles d'un produit, du plus récent au plus ancien.
export async function getAvisPublics(productId) {
	return prisma.review.findMany({
		where: {productId, status: 'APPROVED'},
		orderBy: {createdAt: 'desc'},
		select: {
			id: true,
			authorName: true,
			rating: true,
			title: true,
			content: true,
			verifiedPurchase: true,
			adminReply: true,
			createdAt: true,
		},
	});
}

/// Vrai si cette personne a déjà déposé un avis sur ce produit. Un avis par
/// personne et par pièce : sinon, dix avis du même client font une note.
export async function aDejaDonneSonAvis(productId, userId) {
	if (!userId) return false;

	const existant = await prisma.review.findFirst({where: {productId, userId}});

	return Boolean(existant);
}

/* A-t-elle acheté la pièce ?

   On cherche une commande payée de cette personne contenant une variante de ce
   produit. Le résultat sert au badge « achat vérifié », qui vaut beaucoup pour
   le lecteur — et qui serait mensonger s'il était posé sur simple déclaration. */
async function aAchete(productId, userId) {
	const commande = await prisma.order.findFirst({
		where: {
			userId,
			status: {in: ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED']},
			items: {some: {variant: {productId}}},
		},
		select: {id: true},
	});

	return Boolean(commande);
}

export function validerAvis({note, contenu}) {
	const erreurs = {};

	const valeur = Number(note);

	if (!Number.isInteger(valeur) || valeur < NOTE_MIN || valeur > NOTE_MAX) {
		erreurs.note = 'Donnez une note de 1 à 5 étoiles.';
	}

	const texte = String(contenu ?? '').trim();

	if (texte.length < 10) {
		erreurs.contenu = 'Dites-en un peu plus — dix caractères au minimum.';
	}

	/* Une limite haute, pour deux raisons : personne ne lit un avis de trois
	   pages, et un champ sans borne est une invitation à remplir la base. */
	if (texte.length > 4000) {
		erreurs.contenu = 'C’est un peu long — 4000 caractères au maximum.';
	}

	return {valide: Object.keys(erreurs).length === 0, erreurs};
}

/* Dépose un avis.

   Le nom affiché vient du compte, jamais du formulaire : laisser saisir un nom
   d'auteur permettrait de signer « Le Vieux geek » un avis dithyrambique.

   Le statut dépend du réglage de modération. En modération préalable — le cas
   par défaut — l'avis part en attente et la fonction le dit à l'écran, pour que
   personne ne s'inquiète de ne pas le voir apparaître. */
export async function deposerAvis({productId, utilisateur, note, titre, contenu}) {
	if (!utilisateur) {
		return {ok: false, erreur: 'Connectez-vous pour laisser un avis.'};
	}

	const produit = await prisma.product.findFirst({
		where: {id: productId, archivedAt: null, publishedAt: {not: null, lte: new Date()}},
		select: {id: true},
	});

	if (!produit) return {ok: false, erreur: 'Cette pièce n’est plus en boutique.'};

	if (await aDejaDonneSonAvis(productId, utilisateur.id)) {
		return {ok: false, erreur: 'Vous avez déjà donné votre avis sur cette pièce.'};
	}

	const controle = validerAvis({note, contenu});
	if (!controle.valide) return {ok: false, erreurs: controle.erreurs};

	const reglages = await getSettings();
	const moderationPrealable = reglages['reviews.moderation'] !== 'NONE';

	const avis = await prisma.review.create({
		data: {
			productId,
			userId: utilisateur.id,
			authorName: utilisateur.firstName?.trim() || 'Client de l’antre',
			rating: Number(note),
			title: String(titre ?? '').trim() || null,
			content: String(contenu).trim(),
			status: moderationPrealable ? 'PENDING' : 'APPROVED',
			verifiedPurchase: await aAchete(productId, utilisateur.id),
		},
	});

	// Publication immédiate : la note affichée doit suivre tout de suite.
	if (!moderationPrealable) await recalculerNote(productId);

	return {ok: true, enAttente: moderationPrealable, id: avis.id};
}

/* ── Back-office ──────────────────────────────────────────────────────────── */

export const LIBELLES_MODERATION = {
	PENDING: 'En attente',
	APPROVED: 'Publié',
	REJECTED: 'Refusé',
};

/// Les avis à modérer, les plus anciens d'abord : c'est celui qui attend depuis
/// trois jours qu'il faut traiter en premier, pas le dernier arrivé.
export async function listerAvisAdmin({statut = 'PENDING'} = {}) {
	return prisma.review.findMany({
		where: statut === 'TOUS' ? {} : {status: statut},
		orderBy: {createdAt: statut === 'PENDING' ? 'asc' : 'desc'},
		take: 200,
		include: {
			product: {select: {name: true, slug: true}},
			user: {select: {email: true}},
		},
	});
}

export async function compterAvisEnAttente() {
	return prisma.review.count({where: {status: 'PENDING'}});
}

/* Publie ou refuse un avis.

   Un avis refusé n'est pas supprimé : sans trace, le même client pourrait le
   redéposer indéfiniment sans qu'on comprenne pourquoi il revient. Et la
   décision, une fois prise, se relit.

   La note du produit est recalculée dans la même transaction : une note qui ne
   correspond pas aux avis affichés est le genre d'incohérence qu'on ne remarque
   que le jour où un client la signale. */
export async function modererAvis(id, statut) {
	if (!['APPROVED', 'REJECTED', 'PENDING'].includes(statut)) {
		return {ok: false, erreur: 'Décision inconnue.'};
	}

	const avis = await prisma.review.findUnique({where: {id}, select: {productId: true}});
	if (!avis) return {ok: false, erreur: 'Avis introuvable.'};

	await prisma.$transaction(async (tx) => {
		await tx.review.update({where: {id}, data: {status: statut}});
		await recalculerNote(avis.productId, tx);
	});

	return {ok: true, productId: avis.productId};
}

/* Réponse publique du commerçant sous un avis.

   Elle s'affiche sous l'avis, signée de la boutique. C'est souvent ce qui
   transforme un avis mitigé en preuve de sérieux — à condition d'être visible,
   d'où son affichage sur la fiche produit et non un e-mail privé. */
export async function repondreAvis(id, reponse) {
	const texte = String(reponse ?? '').trim();

	await prisma.review.update({
		where: {id},
		data: {adminReply: texte || null},
	});

	return {ok: true};
}
