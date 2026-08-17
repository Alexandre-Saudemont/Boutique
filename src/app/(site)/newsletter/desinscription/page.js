import Link from 'next/link';
import {Check, X} from 'lucide-react';
import {unsubscribeByToken} from '@/server/services/newsletter';
import styles from '../newsletter.module.css';

/* Désinscription en un clic.

   Aucun bouton, aucune question, aucune tentative de retenir le visiteur :
   c'est ce qu'exige la loi et c'est ce qu'attend quelqu'un qui veut qu'on lui
   fiche la paix. Un parcours qui demande de se connecter ou de justifier son
   départ finit en signalement pour spam, ce qui coûte bien plus cher qu'un
   abonné perdu. */

export const metadata = {
	title: 'Désinscription',
	robots: {index: false},
};

export default async function Desinscription({searchParams}) {
	const {jeton} = await searchParams;

	const resultat = await unsubscribeByToken(jeton);

	return (
		<section className={styles.page}>
			<div className={styles.bloc}>
				<span className={resultat.ok ? styles.iconeOk : styles.iconeEchec}>
					{resultat.ok ? <Check size={30} strokeWidth={3} /> : <X size={30} strokeWidth={3} />}
				</span>

				{resultat.ok ? (
					<>
						<h1 className={styles.titre}>C’est fait.</h1>
						<p className={styles.texte}>
							Cette adresse ne recevra plus la lettre de l’antre. Sans rancune — la
							boutique reste ouverte, et vous pourrez revenir quand vous voudrez.
						</p>
					</>
				) : (
					<>
						<h1 className={styles.titre}>Ce lien n’est plus valable</h1>
						<p className={styles.texte}>
							L’adresse a peut-être déjà été retirée. Si vous recevez encore la lettre
							après ça, écrivez-moi et je m’en occupe à la main.
						</p>
					</>
				)}

				<Link href='/' className='btn btn-secondary' style={{padding: '12px 24px'}}>
					Retour à l’accueil
				</Link>
			</div>
		</section>
	);
}
