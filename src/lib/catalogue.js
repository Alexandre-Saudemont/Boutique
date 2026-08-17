/* Vocabulaire du catalogue, partagé entre le serveur et le navigateur.

   Ces valeurs apparaissent dans les URLs (`?etat=occasion&tri=prix-croissant`),
   donc le service les lit et le sélecteur de tri les écrit. Elles ne peuvent pas
   vivre dans le service, qui est `server-only` : un composant client ne peut pas
   l'importer.

   Ce sont des chaînes en français parce qu'elles sont visibles dans la barre
   d'adresse, contrairement aux enums Prisma (NEW, USED) qui restent internes. */

export const ETATS = {
	NEUF: 'neuf',
	OCCASION: 'occasion',
	PRECOMMANDE: 'precommande',
};

export const LIBELLES_ETAT = {
	[ETATS.NEUF]: 'Neuf',
	[ETATS.OCCASION]: 'Occasion',
	[ETATS.PRECOMMANDE]: 'Précommande',
};

/* L'état d'un ouvrage numérique.

   Volontairement **hors de `ETATS`** : ces valeurs-là construisent les boutons
   de filtre de la boutique et s'écrivent dans l'URL. Un fichier n'est ni neuf ni
   d'occasion — c'est une étiquette à afficher, pas un critère de tri. Le jour où
   le client voudra filtrer sur « numérique », le rayon « Ouvrages du geek » le
   fait déjà. */
export const ETAT_NUMERIQUE = {cle: 'numerique', libelle: 'Numérique'};

/* L'étiquette d'une box surprise. Hors de `ETATS` pour la même raison : une box
   n'est ni neuve ni d'occasion, elle est composée à la main. */
export const ETAT_BOX = {cle: 'box', libelle: 'Sur mesure'};

export const TRIS = {
	NOUVEAUTES: 'nouveautes',
	PRIX_CROISSANT: 'prix-croissant',
	PRIX_DECROISSANT: 'prix-decroissant',
};

/* Un paramètre d'URL est saisi par l'utilisateur : il peut valoir n'importe
   quoi. On ne garde que les valeurs connues, et on retombe sur le défaut
   sinon — plutôt que de laisser une valeur inventée atteindre la requête. */
export function normaliserEtat(valeur) {
	return Object.values(ETATS).includes(valeur) ? valeur : null;
}

export function normaliserTri(valeur) {
	return Object.values(TRIS).includes(valeur) ? valeur : TRIS.NOUVEAUTES;
}
