import {getUtilisateurCourant} from '@/server/auth/session';
import {getCommandesUtilisateur} from '@/server/services/accounts';
import AuthPanel from './AuthPanel';
import EspaceCompte from './EspaceCompte';
import styles from './compte.module.css';

/* Le compte client.

   Deux états dans une seule page, comme dans la maquette : le panneau
   connexion / inscription, ou l'espace du client connecté. Les séparer en deux
   routes obligerait à rediriger dans les deux sens à chaque changement d'état,
   pour un écran qui reste le même dans la tête du visiteur.

   La connexion Google prévue au design n'est pas là : elle demande un projet
   Google Cloud, un écran de consentement et des clés OAuth — un chantier à part
   qui n'a pas de sens tant que la boutique n'ouvre pas. Le modèle est prêt
   (`passwordHash` peut être nul, justement pour les comptes externes). */

export const metadata = {
	title: 'Mon compte',
	robots: {index: false},
};

export default async function Compte({searchParams}) {
	const [utilisateur, parametres] = await Promise.all([getUtilisateurCourant(), searchParams]);

	if (!utilisateur) {
		/* `suite` dit où renvoyer le visiteur une fois connecté — le back-office
		   l'utilise quand quelqu'un ouvre une page d'administration sans session.
		   Seuls les chemins internes sont acceptés : sans ce filtre, un lien
		   « connectez-vous » forgé renverrait le client sur un site tiers juste
		   après avoir tapé son mot de passe. */
		const suite = String(parametres?.suite ?? '');
		const suiteSure = /^\/(?!\/)/.test(suite) ? suite : null;

		return (
			<section className={styles.page}>
				<AuthPanel suite={suiteSure} />
			</section>
		);
	}

	const commandes = await getCommandesUtilisateur(utilisateur.id);

	return (
		<section className={styles.page}>
			<EspaceCompte utilisateur={utilisateur} commandes={commandes} />
		</section>
	);
}
