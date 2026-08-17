import Link from 'next/link';
import {Check, X} from 'lucide-react';
import {confirmerInscription} from '@/server/services/newsletter';
import styles from '../newsletter.module.css';

/* Confirmation d'inscription à la lettre.

   La page confirme au chargement, sans bouton à cliquer : le visiteur a déjà
   agi en ouvrant le lien de son e-mail, lui demander une seconde confirmation
   ferait perdre une inscription sur trois.

   C'est un effet de bord dans une page, ce que l'on évite en principe. Ici il
   est idempotent — confirmer deux fois ne change rien — et le jeton ne peut
   pas être deviné : le préchargement d'un lien par un antivirus ou un client de
   messagerie ne cause aucun dégât qu'on regretterait. */

export const metadata = {
	title: 'Inscription confirmée',
	robots: {index: false},
};

export default async function ConfirmationNewsletter({searchParams}) {
	const {jeton} = await searchParams;

	const resultat = await confirmerInscription(jeton);

	return (
		<section className={styles.page}>
			<div className={styles.bloc}>
				<span className={resultat.ok ? styles.iconeOk : styles.iconeEchec}>
					{resultat.ok ? (
						<Check size={30} strokeWidth={3} />
					) : (
						<X size={30} strokeWidth={3} />
					)}
				</span>

				{resultat.ok ? (
					<>
						<h1 className={styles.titre}>C’est confirmé, merci !</h1>
						<p className={styles.texte}>
							Vous recevrez la lettre de l’antre : les nouveautés, les trouvailles
							d’occasion et les box du mois. Pas plus d’une fois par mois, et jamais
							pour ne rien dire.
						</p>
					</>
				) : (
					<>
						<h1 className={styles.titre}>Ce lien n’est plus valable</h1>
						<p className={styles.texte}>
							Il a peut-être déjà servi, ou l’adresse a été retirée de la liste.
							Réinscrivez-vous depuis le bas de n’importe quelle page, je vous
							renverrai un lien tout neuf.
						</p>
					</>
				)}

				<Link href='/' className='btn btn-primary' style={{padding: '12px 24px'}}>
					Retour à l’accueil
				</Link>
			</div>
		</section>
	);
}
