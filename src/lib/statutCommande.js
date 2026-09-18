/* Statut de commande → classe de `admin.module.css`.

   Un simple objet, sans `server-only` : c'est de la donnée statique, pas une
   requête, et les quatre écrans qui listent des commandes (liste, tableau de
   bord, fiche client, fiche commande) le partagent pour que le même statut
   porte toujours la même couleur, où qu'il s'affiche.

   Le nom de la classe est cherché dans `styles` (le module CSS déjà importé
   par la page) plutôt que retourné tel quel : un module CSS hache ses noms de
   classe, et seul l'objet importé par la page connaît la version réelle. */
export const CLE_LIGNE_STATUT = {
	PENDING_PAYMENT: 'ligneEnAttente',
	PAID: 'lignePayee',
	PREPARING: 'lignePreparation',
	PARTIALLY_SHIPPED: 'lignePartielle',
	SHIPPED: 'ligneExpediee',
	DELIVERED: 'ligneLivree',
	CANCELLED: 'ligneAnnulee',
	REFUNDED: 'ligneRemboursee',
};

/// La classe de ligne pour un statut donné, dans le module CSS `styles` de la
/// page appelante. `''` sur un statut inconnu — la ligne s'affiche sans
/// couleur plutôt que de faire échouer le rendu.
export function classeLigneStatut(styles, statut) {
	return styles[CLE_LIGNE_STATUT[statut]] ?? '';
}
