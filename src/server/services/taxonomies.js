import 'server-only';
import {prisma} from '@/server/db';
import {slugifier} from '@/lib/slug';

/* Rayons, marques et licences.

   Trois tables, un seul fichier : elles ont exactement la même forme — un nom,
   un slug, un état — et le même écran de gestion. Leur donner trois services
   séparés reviendrait à écrire trois fois le même code, avec trois occasions de
   le faire diverger.

   Ce qui les distingue est métier, pas technique : le **rayon** range le
   catalogue et apparaît dans l'URL (`/boutique?rayon=figurines`), la **marque**
   est le fabricant (Bandai, Funko), la **licence** est l'univers (One Piece,
   Cthulhu). Un même produit peut être Bandai *et* One Piece — d'où deux champs
   et non un seul. */

/* Les trois types, décrits une fois.

   `modele` porte le nom du délégué Prisma. C'est ce qui permet à une seule
   fonction de servir les trois — et ce qui impose de ne jamais laisser une
   valeur venue du navigateur choisir ici : seules ces trois clés existent. */
const TYPES = {
	rayon: {modele: 'category', libelle: 'Rayon', pluriel: 'Rayons', arborescent: true},
	marque: {modele: 'brand', libelle: 'Marque', pluriel: 'Marques', arborescent: false},
	licence: {modele: 'licence', libelle: 'Licence', pluriel: 'Licences', arborescent: false},
};

export function typeConnu(type) {
	return Object.hasOwn(TYPES, type);
}

export function descripteur(type) {
	return TYPES[type] ?? null;
}

export const TYPES_TAXONOMIE = Object.entries(TYPES).map(([cle, valeur]) => ({
	cle,
	libelle: valeur.libelle,
	pluriel: valeur.pluriel,
}));

function delegue(type) {
	const descripteurType = TYPES[type];

	// Un type inconnu doit lever, pas retomber sur une table par défaut : c'est
	// exactement le genre de repli silencieux qui écrit dans la mauvaise table.
	if (!descripteurType) throw new Error(`Type de classement inconnu : ${type}`);

	return prisma[descripteurType.modele];
}

/* La liste, avec le nombre de produits rattachés.

   Ce compte n'est pas décoratif : c'est lui qui dit si un rayon peut être
   désactivé sans faire disparaître des fiches de la boutique. */
export async function lister(type) {
	if (type === 'rayon') {
		const rayons = await prisma.category.findMany({
			orderBy: [{position: 'asc'}, {name: 'asc'}],
			include: {_count: {select: {primaryProducts: true}}},
		});

		return rayons.map((rayon) => ({
			id: rayon.id,
			nom: rayon.name,
			slug: rayon.slug,
			actif: rayon.isActive,
			position: rayon.position,
			produits: rayon._count.primaryProducts,
		}));
	}

	const entrees = await delegue(type).findMany({
		orderBy: {name: 'asc'},
		include: {_count: {select: {products: true}}},
	});

	return entrees.map((entree) => ({
		id: entree.id,
		nom: entree.name,
		slug: entree.slug,
		actif: entree.isActive,
		position: 0,
		produits: entree._count.products,
	}));
}

/// Un slug libre pour ce type. Même principe que pour les produits : on suffixe
/// plutôt que de refuser, deux licences peuvent porter des noms proches.
async function slugLibre(type, nom, idAExclure = null) {
	const base = slugifier(nom) || 'entree';

	const voisins = await delegue(type).findMany({
		where: {slug: {startsWith: base}, ...(idAExclure ? {id: {not: idAExclure}} : {})},
		select: {slug: true},
	});

	const pris = new Set(voisins.map((entree) => entree.slug));
	if (!pris.has(base)) return base;

	let rang = 2;
	while (pris.has(`${base}-${rang}`)) rang += 1;

	return `${base}-${rang}`;
}

/* Crée ou renomme une entrée.

   Le slug d'un rayon existant ne bouge pas quand on le renomme : il est dans
   l'URL de la boutique (`/boutique?rayon=figurines`), dans les liens partagés
   et dans ce qu'ont indexé les moteurs. Corriger une faute de frappe dans le
   nom affiché ne doit pas casser ces adresses. */
export async function enregistrer(type, {id, nom, actif = true, position = 0}) {
	if (!typeConnu(type)) return {ok: false, erreurs: {nom: 'Type inconnu.'}};

	const nomPropre = String(nom ?? '').trim();
	if (!nomPropre) return {ok: false, erreurs: {nom: 'Le nom est obligatoire.'}};

	const donnees = {
		name: nomPropre,
		isActive: Boolean(actif),
		...(type === 'rayon' ? {position: Number(position) || 0} : {}),
	};

	const entree = id
		? await delegue(type).update({where: {id}, data: donnees})
		: await delegue(type).create({
				data: {...donnees, slug: await slugLibre(type, nomPropre)},
			});

	return {ok: true, id: entree.id};
}

/* Active ou désactive.

   Pas de suppression, et pour une raison concrète : un rayon supprimé
   détacherait les produits qui s'y rattachent, qui deviendraient introuvables
   au rangement sans que personne ne s'en aperçoive. Désactiver le retire du
   menu de la boutique, les produits gardent leur rattachement. */
export async function basculer(type, id, actif) {
	await delegue(type).update({where: {id}, data: {isActive: Boolean(actif)}});

	return {ok: true};
}
