import 'server-only';
import {prisma} from '@/server/db';
import {ETATS, LIBELLES_ETAT, TRIS} from '@/lib/catalogue';

/* Catalogue.

   Un produit n'a pas de prix : ce sont ses variantes qui en portent un, avec le
   stock et le poids. En vitrine, on affiche la variante par défaut — la moins
   chère active — et la fiche produit laisse ensuite choisir.

   L'« état » affiché en boutique (Neuf / Occasion / Précommande) ne correspond
   pas à un seul champ : la précommande est un booléen (`allowPreorder`) qui se
   superpose à `condition`. Un article neuf en précommande s'affiche
   « Précommande » — c'est l'information qui compte pour l'acheteur. */

function filtreEtat(etat) {
	switch (etat) {
		case ETATS.NEUF:
			return {condition: 'NEW', allowPreorder: false};
		case ETATS.OCCASION:
			return {condition: 'USED'};
		case ETATS.PRECOMMANDE:
			return {allowPreorder: true};
		default:
			return {};
	}
}

/* Un produit n'est en vitrine que s'il est actif, publié et non archivé.
   Cette condition est reprise par toutes les lectures publiques : la
   centraliser évite qu'un oubli n'expose un brouillon.

   C'est une fonction et non une constante parce que `new Date()` doit être
   évalué à l'appel. Dans une constante de module, l'heure serait celle du
   démarrage du serveur, et un produit programmé ne sortirait jamais. */
function conditionsVitrine() {
	return {
		isActive: true,
		archivedAt: null,
		publishedAt: {not: null, lte: new Date()},
	};
}

/* L'état à afficher sur la carte et la fiche.
   La précommande l'emporte sur la condition : pour l'acheteur, savoir que
   l'article n'est pas encore sorti prime sur son état neuf ou d'occasion. */
export function etatProduit(produit) {
	const cle = produit.allowPreorder
		? ETATS.PRECOMMANDE
		: produit.condition === 'USED'
			? ETATS.OCCASION
			: ETATS.NEUF;

	return {cle, libelle: LIBELLES_ETAT[cle]};
}

/* La variante mise en avant : la moins chère parmi les actives. C'est celle qui
   porte le prix affiché en vitrine, d'où le « à partir de » quand il y en a
   plusieurs. */
function varianteAffichee(produit) {
	const actives = produit.variants.filter((v) => v.isActive && !v.archivedAt);
	if (actives.length === 0) return null;

	return actives.reduce((moinsChere, variante) =>
		variante.priceCents < moinsChere.priceCents ? variante : moinsChere,
	);
}

/// Met un produit brut de Prisma en forme pour l'affichage.
function pourAffichage(produit) {
	const variante = varianteAffichee(produit);
	const nbVariantes = produit.variants.filter((v) => v.isActive && !v.archivedAt).length;

	return {
		id: produit.id,
		nom: produit.name,
		slug: produit.slug,
		rayon: produit.primaryCategory?.name ?? null,
		rayonSlug: produit.primaryCategory?.slug ?? null,
		accroche: produit.shortDescription,
		etat: etatProduit(produit),
		prixCents: variante?.priceCents ?? null,
		prixBarreCents: variante?.compareAtPriceCents ?? null,
		aPartirDe: nbVariantes > 1,
		enStock: (variante?.stock ?? 0) > 0 || Boolean(variante?.allowBackorder),
		image: produit.images[0] ?? null,
	};
}

/* Les produits de la vitrine, filtrés et triés.

   Le tri par prix passe par la variante : Prisma ne sait pas ordonner sur une
   valeur agrégée d'une relation, donc on trie en mémoire après coup. C'est
   tenable tant que le catalogue reste petit (quelques centaines de pièces). Au
   delà, il faudra dénormaliser un `prixMinCents` sur Product, tenu à jour à
   l'enregistrement d'une variante. */
export async function listProducts({rayon, etat, tri} = {}) {
	const produits = await prisma.product.findMany({
		where: {
			...conditionsVitrine(),
			...filtreEtat(etat),
			...(rayon ? {primaryCategory: {slug: rayon}} : {}),
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
					// varianteAffichee revérifie ces deux champs. Les omettre du select
					// les rendrait `undefined`, et le filtre rejetterait toutes les
					// variantes — donc plus aucun prix affiché.
					isActive: true,
					archivedAt: true,
				},
			},
			images: {
				orderBy: {position: 'asc'},
				take: 1,
				select: {url: true, alt: true},
			},
		},
	});

	const affichables = produits.map(pourAffichage);

	if (tri === TRIS.PRIX_CROISSANT) {
		return affichables.sort((a, b) => (a.prixCents ?? 0) - (b.prixCents ?? 0));
	}

	if (tri === TRIS.PRIX_DECROISSANT) {
		return affichables.sort((a, b) => (b.prixCents ?? 0) - (a.prixCents ?? 0));
	}

	return affichables; // nouveautés d'abord : déjà l'ordre de la requête
}

/* Le nombre de pièces par rayon, pour la sidebar de la boutique.

   Un groupBy en une requête plutôt qu'un count par rayon : à six rayons la
   différence est mince, mais c'est le genre de boucle de requêtes qui ne se
   remarque qu'une fois le catalogue rempli. */
export async function countByRayon({etat} = {}) {
	const groupes = await prisma.product.groupBy({
		by: ['primaryCategoryId'],
		where: {...conditionsVitrine(), ...filtreEtat(etat)},
		_count: {_all: true},
	});

	const total = groupes.reduce((somme, groupe) => somme + groupe._count._all, 0);
	const parCategorie = Object.fromEntries(
		groupes
			.filter((groupe) => groupe.primaryCategoryId)
			.map((groupe) => [groupe.primaryCategoryId, groupe._count._all]),
	);

	return {total, parCategorie};
}

/// La fiche complète, par slug. `null` si le produit n'est pas en vitrine —
/// à l'appelant d'en faire un 404.
export async function getProductBySlug(slug) {
	const produit = await prisma.product.findFirst({
		where: {slug, ...conditionsVitrine()},
		include: {
			primaryCategory: {select: {id: true, name: true, slug: true}},
			brand: {select: {name: true, slug: true}},
			licence: {select: {name: true, slug: true}},
			variants: {
				where: {isActive: true, archivedAt: null},
				orderBy: {position: 'asc'},
				include: {options: {select: {name: true, value: true}}},
			},
			images: {orderBy: {position: 'asc'}},
		},
	});

	if (!produit) return null;

	const variante = varianteAffichee(produit);

	return {
		...pourAffichage(produit),
		description: produit.longDescription,
		createur: produit.creator,
		marque: produit.brand,
		licence: produit.licence,
		rayonId: produit.primaryCategory?.id ?? null,
		dateSortie: produit.releaseDate,
		enPrecommande: produit.allowPreorder,
		note: produit.averageRating,
		nombreAvis: produit.reviewCount,
		images: produit.images,
		variantes: produit.variants,
		varianteParDefaut: variante,
		metaTitle: produit.metaTitle,
		metaDescription: produit.metaDescription,
	};
}

/// « Dans le même rayon » — le produit courant exclu.
export async function getRelatedProducts(produitId, rayonId, limite = 3) {
	if (!rayonId) return [];

	const produits = await prisma.product.findMany({
		where: {
			...conditionsVitrine(),
			primaryCategoryId: rayonId,
			id: {not: produitId},
		},
		orderBy: {publishedAt: 'desc'},
		take: limite,
		include: {
			primaryCategory: {select: {name: true, slug: true}},
			variants: {
				where: {isActive: true, archivedAt: null},
				select: {
					priceCents: true,
					compareAtPriceCents: true,
					stock: true,
					allowBackorder: true,
					// varianteAffichee revérifie ces deux champs. Les omettre du select
					// les rendrait `undefined`, et le filtre rejetterait toutes les
					// variantes — donc plus aucun prix affiché.
					isActive: true,
					archivedAt: true,
				},
			},
			images: {orderBy: {position: 'asc'}, take: 1, select: {url: true, alt: true}},
		},
	});

	return produits.map(pourAffichage);
}

/// Les slugs publiés, pour generateStaticParams et le sitemap.
export async function getAllProductSlugs() {
	const produits = await prisma.product.findMany({
		where: conditionsVitrine(),
		select: {slug: true, updatedAt: true},
	});

	return produits;
}
