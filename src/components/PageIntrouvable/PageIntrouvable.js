import Link from 'next/link';
import styles from './PageIntrouvable.module.css';

/* Le contenu du 404, sans en-tête ni pied de page.

   Il est isolé dans un composant parce que Next demande deux fichiers pour
   couvrir tous les cas : `(site)/not-found.js` pour un `notFound()` appelé
   depuis une page de la vitrine, et `app/not-found.js` pour une adresse qui ne
   correspond à aucune route du tout. Le second ne traverse pas le layout de la
   vitrine et doit poser son en-tête lui-même — d'où cette découpe, plutôt que
   deux copies du même texte qui divergeraient à la première retouche. */

export default function PageIntrouvable() {
	return (
		<section className={styles.section}>
			{/* Décor. Les deux mêmes formes que l'accueil, pour que la page ratée
			    ressemble encore à la boutique. */}
			<div className={`${styles.blob} ${styles.blobHaut}`} aria-hidden='true' />
			<div className={`${styles.blob} ${styles.blobBas}`} aria-hidden='true' />

			<div className={styles.contenu}>
				{/* Décoratif : le code est déjà porté par le statut HTTP et par le
				    titre qui suit. Le lire à voix haute n'apprend rien. */}
				<div className={styles.code} aria-hidden='true'>
					404
				</div>

				<h1 className={styles.titre}>Cette étagère est vide</h1>

				<p className={styles.texte}>
					La page que vous cherchez a été chinée par quelqu’un d’autre, ou n’a
					jamais existé. Ça arrive, même dans la meilleure des cavernes.
				</p>

				<div className={styles.actions}>
					<Link href='/' className='btn btn-primary'>
						Retour à l’accueil
					</Link>
					<Link href='/boutique' className='btn btn-secondary'>
						Fouiller la boutique
					</Link>
				</div>

				<p className={styles.appoint}>
					Vous cherchiez quelque chose de précis ?{' '}
					<Link href='/recherche' className={styles.lienAppoint}>
						Lancez une recherche →
					</Link>
				</p>
			</div>
		</section>
	);
}
