import 'server-only';
import {prisma} from '@/server/db';

/* Les box surprises.

   À la vente, une box est un produit comme un autre : un prix, un stock — le
   nombre de box préparables — et des variantes pour le thème et la taille. Rien
   de particulier n'était nécessaire pour ça, et rien n'a été ajouté.

   Ce qui vit ici ne sert **pas** à préparer la commande. Celui qui emballe sait
   ce qu'il met dans le carton ; lui demander de le ressaisir pour expédier
   serait du travail pour rien. Ça sert à une seule chose : pouvoir répondre,
   des mois plus tard, à « qu'est-ce qu'il y avait dans ma box ? » ou à un
   client qui dit qu'il manque quelque chose.

   D'où la forme retenue : **une note en texte libre par box**, écrite en dix
   secondes. Un inventaire pièce par pièce serait plus propre à relire, mais il
   coûterait une minute par box — et une note qu'on n'écrit pas ne sert à
   personne. Le contenu vient d'un stock à part qui n'est pas au catalogue :
   rien n'est décompté du stock de la boutique, et rien ne référence de fiche
   produit. */

const LONGUEUR_MAX = 2000;

/* Les box d'une ligne de commande, avec ce qui a été noté dedans.

   Une entrée par exemplaire vendu, même vide : commander trois box donne trois
   cadres à remplir, sinon la deuxième et la troisième n'auraient nulle part où
   être saisies. */
export async function getContenuBoxes(orderItemId) {
	const ligne = await prisma.orderItem.findUnique({
		where: {id: orderItemId},
		select: {
			quantity: true,
			isMysteryBox: true,
			boxContents: {orderBy: {boxNumber: 'asc'}},
		},
	});

	if (!ligne?.isMysteryBox) return [];

	return Array.from({length: ligne.quantity}, (_, index) => {
		const note = ligne.boxContents.find((contenu) => contenu.boxNumber === index + 1);

		return {
			numero: index + 1,
			contenu: note?.content ?? '',
			modifieLe: note?.updatedAt ?? null,
		};
	});
}

/* Enregistre la note d'une box. Écrase la précédente — c'est un bloc-notes, pas
   un journal : on corrige une faute de frappe en réécrivant, et vider le champ
   efface la note.

   La ligne de commande est revérifiée : elle doit exister, être une box, et le
   numéro d'exemplaire doit tenir dans la quantité commandée. Le formulaire
   n'affiche que les bons cadres, mais une action serveur est appelable sans
   passer par sa page. */
export async function enregistrerContenuBox({orderItemId, boxNumber, contenu}) {
	const texte = String(contenu ?? '').trim();

	if (texte.length > LONGUEUR_MAX) {
		return {ok: false, erreur: `Note trop longue (${LONGUEUR_MAX} caractères au maximum).`};
	}

	const ligne = await prisma.orderItem.findUnique({
		where: {id: orderItemId},
		select: {id: true, quantity: true, isMysteryBox: true},
	});

	if (!ligne || !ligne.isMysteryBox) {
		return {ok: false, erreur: 'Cette ligne n’est pas une box surprise.'};
	}

	/* Pas de repli sur 1 en cas de valeur douteuse : `Number(x) || 1` ferait
	   passer un `0` pour la première box, et une note atterrirait dans une box au
	   hasard au lieu d'être refusée. */
	const numero = Math.trunc(Number(boxNumber));

	if (!Number.isFinite(numero) || numero < 1 || numero > ligne.quantity) {
		return {ok: false, erreur: 'Cette box n’existe pas dans la commande.'};
	}

	// Une note vidée est une note supprimée : garder une ligne vide en base
	// laisserait croire qu'un contenu a été saisi.
	if (texte === '') {
		await prisma.boxContent.deleteMany({where: {orderItemId, boxNumber: numero}});
		return {ok: true, vide: true};
	}

	const note = await prisma.boxContent.upsert({
		where: {orderItemId_boxNumber: {orderItemId, boxNumber: numero}},
		update: {content: texte},
		create: {orderItemId, boxNumber: numero, content: texte},
	});

	return {ok: true, note};
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
			boxContents: {orderBy: {boxNumber: 'asc'}},
		},
	});

	return lignes.map((ligne) => ({
		id: ligne.id,
		nom: ligne.productName,
		variante: ligne.variantName,
		exemplaires: Array.from({length: ligne.quantity}, (_, index) => {
			const note = ligne.boxContents.find((contenu) => contenu.boxNumber === index + 1);

			return {
				numero: index + 1,
				contenu: note?.content ?? '',
				modifieLe: note?.updatedAt ?? null,
			};
		}),
	}));
}
