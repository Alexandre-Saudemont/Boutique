import 'server-only';
import {prisma} from '@/server/db';

/* Les box surprises.

   À la vente, une box est un produit comme un autre : un prix, un stock — le
   nombre de box qu'il peut préparer — et des variantes pour le thème et la
   taille. Rien de particulier n'était nécessaire pour ça, et rien n'a été
   ajouté.

   Ce qui la distingue arrive **après** la vente. Chaque exemplaire part avec un
   contenu différent, choisi à la main au moment d'emballer. Sans trace de ce
   choix, personne ne peut répondre six mois plus tard à « qu'est-ce qu'il y
   avait dans ma box ? » — ni à un client qui dit qu'il manque quelque chose.
   Rien n'oblige à transmettre cette information ; sans elle on n'a même pas le
   choix de la donner.

   **Le contenu est du texte libre.** Les pièces mises en box viennent d'un stock
   à part, qui n'est pas au catalogue : les rattacher à des fiches produit
   obligerait à en créer une par pièce jamais vendue à l'unité. Rien n'est
   décompté du stock de la boutique, puisque rien de ce qui entre dans une box
   n'y est en vente. */

/// Le contenu saisi pour une ligne de commande, regroupé par exemplaire.
/// `[{numero: 1, pieces: [...]}, {numero: 2, pieces: []}]` — les box encore
/// vides sont présentes, sinon la deuxième box d'une commande n'aurait aucune
/// ligne où être saisie.
export async function getContenuBoxes(orderItemId) {
	const ligne = await prisma.orderItem.findUnique({
		where: {id: orderItemId},
		select: {
			quantity: true,
			isMysteryBox: true,
			boxContents: {orderBy: [{boxNumber: 'asc'}, {position: 'asc'}]},
		},
	});

	if (!ligne?.isMysteryBox) return [];

	return Array.from({length: ligne.quantity}, (_, index) => ({
		numero: index + 1,
		pieces: ligne.boxContents.filter((piece) => piece.boxNumber === index + 1),
	}));
}

/* Ajoute une pièce au contenu d'une box.

   La ligne de commande est revérifiée : elle doit exister, être une box, et le
   numéro d'exemplaire doit tenir dans la quantité commandée. Un formulaire
   affiche les bons choix au moment du rendu, mais l'écran a pu rester ouvert —
   et une action serveur est appelable sans passer par sa page. */
export async function ajouterPieceBox({orderItemId, boxNumber, label, note = null}) {
	const intitule = String(label ?? '').trim();

	if (!intitule) return {ok: false, erreur: 'Décrivez la pièce mise dans la box.'};
	if (intitule.length > 200) return {ok: false, erreur: 'Intitulé trop long (200 caractères).'};

	const ligne = await prisma.orderItem.findUnique({
		where: {id: orderItemId},
		select: {id: true, quantity: true, isMysteryBox: true},
	});

	if (!ligne || !ligne.isMysteryBox) {
		return {ok: false, erreur: 'Cette ligne n’est pas une box surprise.'};
	}

	/* Pas de repli sur 1 en cas de valeur douteuse : `Number(x) || 1` ferait
	   passer un `0` pour la première box, et une saisie ratée serait rangée dans
	   une box au hasard au lieu d'être refusée. */
	const numero = Math.trunc(Number(boxNumber));

	if (!Number.isFinite(numero) || numero < 1 || numero > ligne.quantity) {
		return {ok: false, erreur: 'Cette box n’existe pas dans la commande.'};
	}

	/* La position suit le rang de saisie, box par box : l'ordre dans lequel le
	   vendeur a rempli le carton est celui dans lequel il le relira. */
	const deja = await prisma.boxContentItem.count({
		where: {orderItemId, boxNumber: numero},
	});

	const piece = await prisma.boxContentItem.create({
		data: {
			orderItemId,
			boxNumber: numero,
			label: intitule,
			note: note ? String(note).trim().slice(0, 500) : null,
			position: deja,
		},
	});

	return {ok: true, piece};
}

/// Retire une pièce. Rien n'est conservé : c'est une note de préparation, pas
/// une pièce comptable — une faute de frappe se corrige en supprimant la ligne.
export async function retirerPieceBox(pieceId) {
	const piece = await prisma.boxContentItem.findUnique({where: {id: pieceId}});

	if (!piece) return {ok: false, erreur: 'Cette pièce n’est plus dans la liste.'};

	await prisma.boxContentItem.delete({where: {id: pieceId}});

	return {ok: true, orderItemId: piece.orderItemId};
}

/// Les box vendues d'une commande, avec leur contenu. Utilisé par la fiche de
/// commande du back-office, qui affiche tout d'un coup.
export async function getBoxesDeLaCommande(orderId) {
	const lignes = await prisma.orderItem.findMany({
		where: {orderId, isMysteryBox: true},
		select: {
			id: true,
			productName: true,
			variantName: true,
			quantity: true,
			boxContents: {orderBy: [{boxNumber: 'asc'}, {position: 'asc'}]},
		},
	});

	return lignes.map((ligne) => ({
		id: ligne.id,
		nom: ligne.productName,
		variante: ligne.variantName,
		exemplaires: Array.from({length: ligne.quantity}, (_, index) => ({
			numero: index + 1,
			pieces: ligne.boxContents.filter((piece) => piece.boxNumber === index + 1),
		})),
	}));
}
