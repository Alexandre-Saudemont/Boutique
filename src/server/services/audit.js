import 'server-only';
import {prisma} from '@/server/db';

/* Journal des actions du personnel.

   À quoi ça sert, concrètement : répondre à « qui a changé ce prix ? », « qui a
   annulé cette commande ? », « pourquoi ce produit a disparu de la boutique ? ».
   Tant qu'une seule personne gère le site, la réponse est évidente. Dès qu'il y
   en a deux, elle ne l'est plus — et le journal protège autant celui qu'on
   soupçonne à tort que la boutique elle-même.

   Trois règles.

   **On ne journalise que les écritures.** Consigner les lectures produirait un
   volume énorme dans lequel les gestes importants se noieraient.

   **Aucune donnée sensible dans `metadata`.** Ni mot de passe, ni jeton, ni
   coordonnées bancaires — évidemment — mais pas non plus l'adresse complète
   d'un client : le journal est conservé bien plus longtemps que nécessaire pour
   ces données-là. On garde des identifiants et des valeurs métier.

   **Journaliser ne doit jamais faire échouer l'action.** Une commande passée en
   « expédiée » l'est ; si l'écriture du journal échoue, on perd une ligne de
   journal, pas le travail de la personne. */

export const ACTIONS = {
	COMMANDE_STATUT: 'order.status_changed',
	COMMANDE_NOTE: 'order.note_updated',
	PRODUIT_CREE: 'product.created',
	PRODUIT_MODIFIE: 'product.updated',
	PRODUIT_ARCHIVE: 'product.archived',
	PRODUIT_RESTAURE: 'product.restored',
	REGLAGES_MODIFIES: 'settings.updated',
	LIVRAISON_MODIFIEE: 'shipping.updated',
	RAYON_MODIFIE: 'category.updated',
	ARTICLE_ENREGISTRE: 'post.saved',
	ABONNE_RETIRE: 'subscriber.unsubscribed',
	AVIS_MODERE: 'review.moderated',
	AVIS_REPONDU: 'review.replied',
	ROLE_MODIFIE: 'user.role_changed',
};

export async function journaliser({utilisateurId, action, type, id, details = null}) {
	try {
		await prisma.auditLog.create({
			data: {
				userId: utilisateurId ?? null,
				action,
				entityType: type,
				entityId: id,
				metadata: details,
			},
		});
	} catch (erreur) {
		// Le journal est un témoin, pas un verrou : son échec se note et se
		// regarde plus tard, il n'annule rien.
		console.error('[audit] écriture impossible :', erreur);
	}
}

/* L'historique d'un objet, du plus récent au plus ancien.

   Sert à afficher « qui a fait quoi » sur une fiche commande ou produit. Le nom
   de l'auteur est joint ici plutôt que dans la page : c'est une jointure, elle
   appartient au service. */
export async function historique(type, id, limite = 20) {
	return prisma.auditLog.findMany({
		where: {entityType: type, entityId: id},
		orderBy: {createdAt: 'desc'},
		take: limite,
		include: {user: {select: {firstName: true, lastName: true, email: true}}},
	});
}
