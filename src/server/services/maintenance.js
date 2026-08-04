import 'server-only';
import {purgerJetons} from '@/server/auth/tokens';
import {prisma} from '@/server/db';

/* Ménage des lignes périmées.

   Rien ici n'est une mesure de sécurité : un jeton expiré est déjà refusé, une
   session expirée aussi, un panier invité oublié n'est atteignable que par un
   cookie qui n'existe plus. Ce sont des tables qui grossissent sans jamais
   maigrir, et une table qui grossit finit par coûter — en sauvegardes, en temps
   de requête, et en données personnelles conservées sans raison.

   Ce dernier point est le vrai motif : le RGPD demande de ne pas garder
   indéfiniment ce dont on n'a plus l'usage. Un panier invité de l'an dernier
   n'a plus d'usage.

   **Chaque purge est indépendante.** Une qui échoue ne doit pas empêcher les
   autres de passer — le ménage est du travail de fond, il se rattrape au
   prochain tour. C'est aussi pour ça qu'il ne lève jamais : appelé par un
   travail programmé, il rend un compte-rendu plutôt qu'une exception. */

/* **Ce qu'on ne purge pas, et pourquoi.** Les droits de téléchargement
   (`DownloadGrant`) portent une date d'expiration et ressemblent donc à un bon
   candidat. Ils n'en sont pas : cette date ne borne que le lien envoyé par
   e-mail, alors que la ligne elle-même est le support de l'accès « à vie depuis
   le compte » promis à l'acheteur. Les supprimer retirerait au client ce qu'il a
   payé. Ils partent à l'anonymisation du compte, et là seulement.

   Délais de conservation. Généreux volontairement : le but est de borner la
   croissance, pas de faire de la place. Un panier récupéré trois semaines plus
   tard fait plaisir à son propriétaire. */
const JOURS_JETONS = 30;
const JOURS_SESSIONS = 7;
const JOURS_PANIERS = 30;

function dateSeuil(jours) {
	const limite = new Date();
	limite.setDate(limite.getDate() - jours);
	return limite;
}

async function tenter(nom, travail) {
	try {
		return {nom, supprimes: await travail()};
	} catch (erreur) {
		console.error(`[ménage] ${nom} :`, erreur);
		return {nom, supprimes: 0, erreur: erreur.message};
	}
}

/* Sessions expirées depuis assez longtemps pour que plus personne ne s'y
   reconnecte. `getUtilisateurCourant` en supprime déjà une au passage quand
   elle est présentée ; celles-ci ne le seront jamais — leur propriétaire a
   changé de machine ou effacé ses cookies. */
async function purgerSessions() {
	const {count} = await prisma.session.deleteMany({
		where: {expiresAt: {lt: dateSeuil(JOURS_SESSIONS)}},
	});
	return count;
}

/* Paniers d'invités abandonnés. Les lignes partent en cascade avec le panier.

   `userId: null` est la condition qui compte : le panier d'un compte n'a pas de
   date d'expiration à respecter, il appartient à quelqu'un qui peut le
   retrouver en se connectant. Le vider serait une perte de commande, exactement
   ce qu'on a corrigé lors de l'audit. */
async function purgerPaniersInvites() {
	const {count} = await prisma.cart.deleteMany({
		where: {
			userId: null,
			expiresAt: {not: null, lt: dateSeuil(JOURS_PANIERS)},
		},
	});
	return count;
}

/// Passe de ménage complète. Ne lève jamais : renvoie ce qui a été supprimé et
/// ce qui a échoué, pour que l'appelant puisse le journaliser.
export async function menageProgramme() {
	const taches = [
		await tenter('jetons', () => purgerJetons(JOURS_JETONS)),
		await tenter('sessions', purgerSessions),
		await tenter('paniers', purgerPaniersInvites),
	];

	const total = taches.reduce((somme, tache) => somme + tache.supprimes, 0);
	const echecs = taches.filter((tache) => tache.erreur);

	return {
		total,
		detail: Object.fromEntries(taches.map((tache) => [tache.nom, tache.supprimes])),
		echecs: echecs.map((tache) => tache.nom),
	};
}
