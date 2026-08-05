import 'server-only';
import {prisma} from '@/server/db';
import {ETAT_BOX} from '@/lib/catalogue';

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

/* Le rayon qui porte les box. Le slug est celui du seed d'installation :
   c'est la seule chose qui relie la page /box au catalogue, autant qu'elle
   soit nommée une fois. */
export const RAYON_BOX = 'box-surprise';

/* ── Vitrine ────────────────────────────────────────────────────────────────*/

/* Les tailles proposées, lues sur les variantes réelles.

   Écrites en dur, elles finiraient par mentir : le menu du site proposait
   « S, M, L » quand une box n'existe qu'en M, et le visiteur tombait sur une
   page vide. Ici, une taille n'apparaît que si une box la porte vraiment.

   L'ordre est imposé — S, M, L — parce qu'un tri alphabétique donnerait
   L, M, S, ce qui ne veut rien dire pour une taille. Ce qui sort de cette
   liste est rangé après, par ordre d'apparition. */
const ORDRE_TAILLES = ['S', 'M', 'L', 'XL'];

function rangTaille(taille) {
	const rang = ORDRE_TAILLES.indexOf(taille.toUpperCase());

	return rang === -1 ? ORDRE_TAILLES.length : rang;
}

/// Les tailles existantes et leur prix d'entrée, pour les filtres et le menu.
export async function getTaillesBox() {
	const options = await prisma.variantOption.findMany({
		where: {
			name: {equals: 'Taille', mode: 'insensitive'},
			variant: {
				isActive: true,
				archivedAt: null,
				product: {
					isActive: true,
					archivedAt: null,
					publishedAt: {not: null, lte: new Date()},
					primaryCategory: {slug: RAYON_BOX},
				},
			},
		},
		select: {value: true, variant: {select: {priceCents: true}}},
	});

	// Une taille peut exister sur plusieurs box à des prix différents : on garde
	// le plus bas, celui qu'annonce le « dès X € » du menu.
	const parTaille = new Map();

	for (const option of options) {
		const actuel = parTaille.get(option.value);
		const prix = option.variant.priceCents;

		if (actuel === undefined || prix < actuel) parTaille.set(option.value, prix);
	}

	return [...parTaille]
		.map(([nom, prixCents]) => ({nom, prixCents}))
		.sort((a, b) => rangTaille(a.nom) - rangTaille(b.nom));
}

/* Les box en vitrine, éventuellement d'une seule taille.

   Chaque box est un produit du rayon, et ses tailles sont ses variantes. Filtrer
   sur une taille ne retire donc pas des box de la liste au hasard : ça ne garde
   que celles qui existent dans cette taille, et le prix affiché devient celui de
   cette taille précise — pas le prix d'appel de la plus petite.

   La forme retournée est celle qu'attend `ProductCard` : la page des box réutilise
   la carte du catalogue, plutôt que d'en redessiner une presque identique. */
export async function listerBoxes({taille} = {}) {
	const produits = await prisma.product.findMany({
		where: {
			isActive: true,
			archivedAt: null,
			publishedAt: {not: null, lte: new Date()},
			primaryCategory: {slug: RAYON_BOX},
			...(taille
				? {
						variants: {
							some: {
								isActive: true,
								archivedAt: null,
								options: {
									some: {
										name: {equals: 'Taille', mode: 'insensitive'},
										value: {equals: taille, mode: 'insensitive'},
									},
								},
							},
						},
					}
				: {}),
		},
		orderBy: {publishedAt: 'desc'},
		include: {
			primaryCategory: {select: {name: true, slug: true}},
			variants: {
				where: {isActive: true, archivedAt: null},
				select: {
					priceCents: true,
					compareAtPriceCents: true,
					stock: true,
					allowBackorder: true,
					options: {select: {name: true, value: true}},
				},
			},
			images: {orderBy: {position: 'asc'}, take: 1, select: {url: true, alt: true}},
		},
	});

	return produits.map((produit) => {
		const retenues = taille
			? produit.variants.filter((variante) =>
					variante.options.some(
						(option) =>
							option.name.toLowerCase() === 'taille' &&
							option.value.toLowerCase() === taille.toLowerCase(),
					),
				)
			: produit.variants;

		const moinsChere = retenues.reduce(
			(basse, variante) => (basse === null || variante.priceCents < basse.priceCents ? variante : basse),
			null,
		);

		const tailles = produit.variants
			.flatMap((variante) =>
				variante.options
					.filter((option) => option.name.toLowerCase() === 'taille')
					.map((option) => option.value),
			)
			.sort((a, b) => rangTaille(a) - rangTaille(b));

		return {
			id: produit.id,
			nom: produit.name,
			slug: produit.slug,
			rayon: produit.primaryCategory?.name ?? null,
			accroche: produit.shortDescription,
			// Une box n'est ni neuve ni d'occasion : elle est composée à la main.
			etat: ETAT_BOX,
			prixCents: moinsChere?.priceCents ?? null,
			prixBarreCents: moinsChere?.compareAtPriceCents ?? null,
			aPartirDe: !taille && retenues.length > 1,
			enStock: retenues.some(
				(variante) => variante.stock > 0 || variante.allowBackorder,
			),
			image: produit.images[0] ?? null,
			tailles,
		};
	});
}

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
