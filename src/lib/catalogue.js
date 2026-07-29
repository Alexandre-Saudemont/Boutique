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
