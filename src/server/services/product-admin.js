import 'server-only';
import {prisma} from '@/server/db';
import {slugifier} from '@/lib/slug';

/* Écriture du catalogue.

   Séparé de `products.js`, qui ne fait que lire pour la vitrine. Ce sont deux
   métiers : l'un sert des pages publiques et ne doit jamais laisser fuiter un
   brouillon, l'autre crée et corrige. Mélanger les deux dans un fichier finit
   toujours par un `where` de vitrine oublié sur une écriture — ou l'inverse.

   Une règle traverse tout ce fichier : **rien n'est supprimé**. Un produit
   retiré de la vente est archivé (`archivedAt`), jamais effacé, parce qu'il
   figure peut-être sur une facture émise. */

/* Un slug libre, dérivé du nom.

   En cas de collision on suffixe -2, -3… plutôt que de refuser l'enregistrement :
   deux figurines peuvent légitimement porter le même nom, et faire échouer la
   saisie sur ce motif obligerait à inventer un nom différent pour satisfaire une
   contrainte technique. */
async function slugLibre(nom, idAExclure = null) {
	const base = slugifier(nom) || 'produit';

	const voisins = await prisma.product.findMany({
		where: {slug: {startsWith: base}, ...(idAExclure ? {id: {not: idAExclure}} : {})},
		select: {slug: true},
	});

	const pris = new Set(voisins.map((p) => p.slug));
	if (!pris.has(base)) return base;

	let rang = 2;
	while (pris.has(`${base}-${rang}`)) rang += 1;

	return `${base}-${rang}`;
}

/// Le SKU d'une variante nouvelle, quand la saisie l'a laissé vide. Lisible en
/// entrepôt (`RONIN-CERISIERS-A3F2`) et sans collision grâce au suffixe.
function skuAuto(nomProduit, nomVariante) {
	const base = slugifier(`${nomProduit} ${nomVariante === 'Standard' ? '' : nomVariante}`)
		.toUpperCase()
		.slice(0, 24);

	const suffixe = Math.random().toString(36).slice(2, 6).toUpperCase();

	return `${base || 'REF'}-${suffixe}`;
}

/* Le prix, saisi en euros, converti en centimes.

   La saisie accepte « 74,90 », « 74.90 » et « 74 » — un commerçant tape la
   virgule française sans y penser. Le résultat est arrondi à l'entier : un
   demi-centime n'existe pas en caisse. */
export function prixEnCentimes(saisie) {
	const texte = String(saisie ?? '')
		.replace(/\s/g, '')
		.replace(',', '.');

	if (!/^\d+(\.\d{1,2})?$/.test(texte)) return null;

	return Math.round(Number(texte) * 100);
}

/// Les listes déroulantes du formulaire. Une seule requête pour les trois.
export async function getReferentiels() {
	const [categories, marques, licences] = await Promise.all([
		prisma.category.findMany({
			where: {isActive: true},
			orderBy: {position: 'asc'},
			select: {id: true, name: true},
		}),
		prisma.brand.findMany({where: {isActive: true}, select: {id: true, name: true}}),
		prisma.licence.findMany({where: {isActive: true}, select: {id: true, name: true}}),
	]);

	return {categories, marques, licences};
}

/// Un produit avec tout ce que le formulaire doit pouvoir réafficher.
export async function getProduitPourEdition(id) {
	return prisma.product.findUnique({
		where: {id},
		include: {
			variants: {where: {archivedAt: null}, orderBy: {position: 'asc'}},
			images: {orderBy: {position: 'asc'}},
		},
	});
}

const KINDS = ['PHYSICAL', 'DIGITAL'];
const CONDITIONS = ['NEW', 'USED'];

/* Valide la saisie et la met en forme.

   Les messages sont rendus champ par champ : « le prix est invalide » en haut
   d'un formulaire de vingt lignes oblige à chercher lequel. */
export function validerProduit(saisie) {
	const erreurs = {};

	if (!String(saisie.nom ?? '').trim()) erreurs.nom = 'Le nom est obligatoire.';

	if (!Array.isArray(saisie.variantes) || saisie.variantes.length === 0) {
		erreurs.variantes = 'Il faut au moins une variante — c’est elle qui porte le prix.';
	}

	saisie.variantes?.forEach((variante, index) => {
		if (prixEnCentimes(variante.prix) === null) {
			erreurs[`variante.${index}.prix`] = 'Prix invalide (ex. 74,90).';
		}

		if (!/^\d+$/.test(String(variante.stock ?? ''))) {
			erreurs[`variante.${index}.stock`] = 'Le stock est un nombre entier.';
		}
	});

	if (saisie.kind && !KINDS.includes(saisie.kind)) erreurs.kind = 'Type inconnu.';
	if (saisie.condition && !CONDITIONS.includes(saisie.condition)) {
		erreurs.condition = 'État inconnu.';
	}

	return {valide: Object.keys(erreurs).length === 0, erreurs};
}

/* Crée ou met à jour un produit, ses variantes et ses images.

   Une seule fonction pour les deux cas : la création n'est que la mise à jour
   d'un produit qui n'existe pas encore, et les faire diverger, c'est prendre le
   risque qu'un champ soit géré d'un côté et pas de l'autre.

   Le tout en transaction. À mi-chemin, un produit sans variante n'a pas de prix
   et casserait la fiche publique.

   Les images passent par leur URL et non par un téléversement : aucun stockage
   de fichiers n'est en place (ni S3, ni disque persistant), et bricoler un
   dossier local qui disparaîtra au premier déploiement rendrait un mauvais
   service. C'est le prochain chantier du back-office. */
export async function enregistrerProduit(saisie) {
	const controle = validerProduit(saisie);
	if (!controle.valide) return {ok: false, erreurs: controle.erreurs};

	const nom = String(saisie.nom).trim();
	const enLigne = saisie.publication === 'EN_LIGNE';

	const donneesProduit = {
		name: nom,
		kind: saisie.kind ?? 'PHYSICAL',
		condition: saisie.condition ?? 'NEW',
		shortDescription: saisie.accroche?.trim() || null,
		longDescription: saisie.description?.trim() || null,
		primaryCategoryId: saisie.categorieId || null,
		brandId: saisie.marqueId || null,
		licenceId: saisie.licenceId || null,
		allowPreorder: Boolean(saisie.precommande),
		isActive: saisie.publication !== 'DESACTIVE',
	};

	const produit = await prisma.$transaction(async (tx) => {
		let cible;

		if (saisie.id) {
			const existant = await tx.product.findUnique({
				where: {id: saisie.id},
				select: {id: true, name: true, slug: true, publishedAt: true},
			});

			if (!existant) throw new Error('Produit introuvable.');

			/* Le slug ne suit le nom que tant que le produit n'est pas publié.
			   Après, il est dans les liens partagés et indexé par les moteurs : le
			   changer casserait ces adresses au premier coup de correcteur sur le
			   titre. */
			const slug =
				existant.publishedAt || existant.name === nom
					? existant.slug
					: await slugLibre(nom, existant.id);

			cible = await tx.product.update({
				where: {id: existant.id},
				data: {
					...donneesProduit,
					slug,
					/* Publier pose la date si elle manque ; dépublier la retire. C'est
					   `publishedAt` qui commande l'affichage en vitrine, et une date
					   laissée derrière republierait le produit au prochain
					   enregistrement. */
					publishedAt: enLigne ? (existant.publishedAt ?? new Date()) : null,
				},
			});
		} else {
			cible = await tx.product.create({
				data: {
					...donneesProduit,
					slug: await slugLibre(nom),
					publishedAt: enLigne ? new Date() : null,
				},
			});
		}

		/* Les variantes absentes de la saisie sont archivées, pas supprimées :
		   elles sont référencées par des lignes de commande passées. */
		const idsGardes = saisie.variantes.map((v) => v.id).filter(Boolean);

		await tx.productVariant.updateMany({
			where: {productId: cible.id, id: {notIn: idsGardes}, archivedAt: null},
			data: {archivedAt: new Date(), isActive: false},
		});

		for (const [index, variante] of saisie.variantes.entries()) {
			const donneesVariante = {
				name: variante.nom?.trim() || 'Standard',
				priceCents: prixEnCentimes(variante.prix),
				stock: Number(variante.stock),
				isActive: variante.etat !== 'SUSPENDUE',
				position: index,
			};

			if (variante.id) {
				await tx.productVariant.update({where: {id: variante.id}, data: donneesVariante});
			} else {
				await tx.productVariant.create({
					data: {
						...donneesVariante,
						productId: cible.id,
						sku: variante.sku?.trim() || skuAuto(nom, donneesVariante.name),
					},
				});
			}
		}

		/* Les images sont réécrites en bloc : la liste saisie fait foi. Elles ne
		   portent aucune donnée métier, rien ne se perd à les recréer. */
		await tx.productImage.deleteMany({where: {productId: cible.id}});

		const images = (saisie.images ?? []).filter((image) => image.url?.trim());

		if (images.length > 0) {
			await tx.productImage.createMany({
				data: images.map((image, index) => ({
					productId: cible.id,
					url: image.url.trim(),
					alt: image.alt?.trim() || nom,
					position: index,
				})),
			});
		}

		return cible;
	});

	return {ok: true, id: produit.id, slug: produit.slug};
}

/// Retire un produit de la vente sans effacer son histoire. Ses variantes
/// suivent : une variante active sur un produit archivé pourrait encore être
/// ajoutée au panier par une URL directe.
export async function archiverProduit(id) {
	const maintenant = new Date();

	await prisma.$transaction([
		prisma.product.update({
			where: {id},
			data: {archivedAt: maintenant, isActive: false, publishedAt: null},
		}),
		prisma.productVariant.updateMany({
			where: {productId: id},
			data: {isActive: false},
		}),
		// Un produit archivé ne doit pas rester dans les paniers en cours : le
		// client verrait sa commande échouer au paiement, sans comprendre.
		prisma.cartItem.deleteMany({where: {variant: {productId: id}}}),
	]);

	return {ok: true};
}

/// Remet un produit archivé en brouillon — pas directement en ligne : on le
/// relit avant de le remettre en vitrine.
export async function restaurerProduit(id) {
	await prisma.product.update({
		where: {id},
		data: {archivedAt: null, isActive: true, publishedAt: null},
	});

	return {ok: true};
}
