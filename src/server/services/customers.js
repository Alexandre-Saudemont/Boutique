import 'server-only';
import {prisma} from '@/server/db';
import {ROLES_STAFF} from '@/server/auth/roles';

/* Les comptes, vus du back-office.

   Deux usages qui n'ont rien à voir, et c'est important de les distinguer :
   retrouver un client au téléphone (droit `clients.voir`), et décider qui a
   accès à quoi (droit `personnel.gerer`).

   Ce que ce fichier ne fait pas, volontairement : supprimer un compte. Le droit
   à l'effacement s'exerce depuis l'espace client, avec le mot de passe du
   titulaire. Un bouton « supprimer » en administration ferait de l'anonymisation
   une sanction, alors que c'est un droit de la personne. */

/* La liste, avec le nombre de commandes.

   Les comptes anonymisés sont écartés : il n'y a plus rien à en faire, et ils
   encombreraient la recherche de lignes vides. */
export async function listerClients({recherche = null, staffSeulement = false} = {}) {
	const terme = recherche?.trim();

	const where = {
		anonymizedAt: null,
		...(staffSeulement ? {role: {in: ROLES_STAFF}} : {}),
		...(terme
			? {
					OR: [
						{email: {contains: terme, mode: 'insensitive'}},
						{firstName: {contains: terme, mode: 'insensitive'}},
						{lastName: {contains: terme, mode: 'insensitive'}},
					],
				}
			: {}),
	};

	const comptes = await prisma.user.findMany({
		where,
		orderBy: {createdAt: 'desc'},
		take: 200,
		select: {
			id: true,
			email: true,
			firstName: true,
			lastName: true,
			role: true,
			emailVerifiedAt: true,
			lastLoginAt: true,
			createdAt: true,
			_count: {select: {orders: true}},
		},
	});

	return comptes.map((compte) => ({
		id: compte.id,
		email: compte.email,
		nom: [compte.firstName, compte.lastName].filter(Boolean).join(' ') || null,
		role: compte.role,
		verifie: Boolean(compte.emailVerifiedAt),
		derniereConnexion: compte.lastLoginAt,
		inscritLe: compte.createdAt,
		commandes: compte._count.orders,
	}));
}

/* La fiche d'un compte : ses commandes, sans les détails de facturation.

   On remonte le numéro, la date, le statut et le total — de quoi répondre à
   « où en est ma commande ? ». Le détail se lit sur la fiche commande, qui a
   son propre écran et son propre droit. */
export async function getClient(id) {
	const compte = await prisma.user.findUnique({
		where: {id},
		select: {
			id: true,
			email: true,
			firstName: true,
			lastName: true,
			phone: true,
			role: true,
			emailVerifiedAt: true,
			marketingOptIn: true,
			lastLoginAt: true,
			createdAt: true,
			anonymizedAt: true,
			orders: {
				orderBy: {createdAt: 'desc'},
				take: 20,
				select: {
					orderNumber: true,
					status: true,
					totalCents: true,
					createdAt: true,
				},
			},
			_count: {select: {sessions: true}},
		},
	});

	return compte;
}

export const LIBELLES_ROLE = {
	CUSTOMER: 'Client',
	ADMIN: 'Administrateur',
	STAFF_ORDERS: 'Préparation des commandes',
	STAFF_SUPPORT: 'Service client',
};

/* Change le rôle d'un compte.

   Trois garde-fous, chacun contre une manière précise de casser la boutique.

   **On ne modifie pas son propre rôle.** Se rétrograder par mégarde fermerait
   la porte derrière soi, sans moyen de revenir.

   **Il reste toujours au moins un administrateur.** Retirer le dernier laisserait
   une boutique que plus personne ne peut administrer — il faudrait une
   intervention en base pour la rouvrir.

   **Le rôle demandé doit exister.** Une valeur forgée ne doit pas atterrir en
   base, où elle donnerait un compte sans aucun droit reconnu. */
export async function changerRole({cibleId, role, auteurId}) {
	if (!Object.hasOwn(LIBELLES_ROLE, role)) {
		return {ok: false, erreur: 'Rôle inconnu.'};
	}

	if (cibleId === auteurId) {
		return {ok: false, erreur: 'Vous ne pouvez pas modifier votre propre rôle.'};
	}

	const cible = await prisma.user.findUnique({
		where: {id: cibleId},
		select: {id: true, role: true, anonymizedAt: true},
	});

	if (!cible || cible.anonymizedAt) return {ok: false, erreur: 'Compte introuvable.'};

	if (cible.role === 'ADMIN' && role !== 'ADMIN') {
		const autresAdmins = await prisma.user.count({
			where: {role: 'ADMIN', anonymizedAt: null, id: {not: cibleId}},
		});

		if (autresAdmins === 0) {
			return {
				ok: false,
				erreur: 'C’est le dernier administrateur : nommez-en un autre avant de lui retirer ses droits.',
			};
		}
	}

	await prisma.$transaction(async (tx) => {
		await tx.user.update({where: {id: cibleId}, data: {role}});

		/* Les sessions ouvertes sont fermées : les droits sont relus à chaque
		   requête, mais on préfère que la personne se reconnecte plutôt que de
		   voir son écran changer sous ses yeux au milieu d'une tâche. C'est aussi
		   la seule façon de couper net l'accès de quelqu'un qui vient d'être
		   rétrogradé. */
		await tx.session.deleteMany({where: {userId: cibleId}});
	});

	return {ok: true};
}
