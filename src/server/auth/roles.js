import 'server-only';
import {redirect} from 'next/navigation';
import {getUtilisateurCourant} from '@/server/auth/session';

/* Qui a le droit de faire quoi dans le back-office.

   Les droits sont nommés par ce qu'ils permettent — `commandes.gerer` — et non
   par les rôles qui les possèdent. Le jour où un rôle change de périmètre, une
   seule ligne bouge ici ; les pages, elles, continuent de demander un droit.

   Le découpage suit ce qui a été prévu au modèle de données : le préparateur
   touche aux commandes et au stock mais ne fixe pas les prix, le service client
   lit les commandes sans les modifier, et le chiffre d'affaires ne s'affiche
   qu'à l'administrateur — c'est le revenu du foyer, pas une donnée d'équipe. */

const DROITS = {
	'commandes.voir': ['ADMIN', 'STAFF_ORDERS', 'STAFF_SUPPORT'],
	'commandes.gerer': ['ADMIN', 'STAFF_ORDERS'],
	'produits.voir': ['ADMIN', 'STAFF_ORDERS'],
	'produits.gerer': ['ADMIN'],
	'abonnes.voir': ['ADMIN'],
	'reglages.gerer': ['ADMIN'],
	'finances.voir': ['ADMIN'],

	/* La modération des avis va au service client : c'est la même conversation
	   que répondre à un e-mail mécontent, et ça n'a rien à voir avec la
	   préparation des colis. */
	'avis.moderer': ['ADMIN', 'STAFF_SUPPORT'],

	/* Consulter la fiche d'un client — ses commandes, son adresse de contact —
	   sert à répondre au téléphone. Le préparateur n'en a pas besoin : il
	   travaille sur les commandes, qui portent déjà l'adresse d'expédition. */
	'clients.voir': ['ADMIN', 'STAFF_SUPPORT'],

	/* Donner ou retirer un rôle est l'action la plus lourde du back-office :
	   elle décide de qui peut faire quoi. Elle reste à l'administrateur seul,
	   même si l'équipe grandit. */
	'personnel.gerer': ['ADMIN'],
};

/// Tous les rôles qui ouvrent le back-office, quel qu'en soit le périmètre.
export const ROLES_STAFF = ['ADMIN', 'STAFF_ORDERS', 'STAFF_SUPPORT'];

export function estStaff(utilisateur) {
	return Boolean(utilisateur) && ROLES_STAFF.includes(utilisateur.role);
}

export function aLeDroit(utilisateur, droit) {
	if (!utilisateur) return false;

	const roles = DROITS[droit];

	// Un droit mal orthographié ne doit jamais être accordé par défaut : une
	// faute de frappe ouvrirait la page à tout le monde.
	if (!roles) return false;

	return roles.includes(utilisateur.role);
}

/* Le membre de l'équipe connecté, ou une redirection.

   Deux cas volontairement distincts. Sans session, on renvoie vers la page de
   connexion — c'est un oubli, pas une faute. Avec une session de client, on
   renvoie à l'accueil : annoncer « accès refusé » confirmerait à un curieux
   qu'il a trouvé une porte, et il n'a rien à faire de cette information. */
export async function exigerStaff() {
	const utilisateur = await getUtilisateurCourant();

	if (!utilisateur) redirect('/compte?suite=/admin');
	if (!estStaff(utilisateur)) redirect('/');

	return utilisateur;
}

/// Comme `exigerStaff`, mais pour une page ou une action qui demande un droit
/// précis. Un préparateur qui tente d'ouvrir les réglages repart au tableau de
/// bord plutôt que sur une page vide.
export async function exigerDroit(droit) {
	const utilisateur = await exigerStaff();

	if (!aLeDroit(utilisateur, droit)) redirect('/admin');

	return utilisateur;
}
