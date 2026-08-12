'use client';

import Link from 'next/link';
import styles from './erreur.module.css';

/* L'écran d'erreur de la vitrine.

   Next impose `'use client'` ici : le composant reçoit une fonction `reset`,
   qui ne peut exister que dans le navigateur. C'est la seule raison — rien
   d'autre sur cette page n'est interactif.

   Ce qu'on n'affiche pas : `error.message`. Le message d'une exception serveur
   cite volontiers un nom de table, une requête SQL ou un bout de chaîne de
   connexion. Le visiteur n'en fera rien, un curieux si. Seul le `digest` est
   montré — un identifiant opaque, généré par Next, qui permet de retrouver la
   trace complète dans les journaux du serveur quand le client nous écrit. */

export default function Erreur({error, reset}) {
	return (
		<section className={styles.section}>
			<div className={styles.contenu}>
				<h1 className={styles.titre}>Un rayon s’est effondré</h1>

				<p className={styles.texte}>
					Quelque chose a mal tourné de notre côté — pas du vôtre. L’incident
					est enregistré. Réessayez : la plupart du temps, ça repart.
				</p>

				<div className={styles.actions}>
					<button type='button' onClick={reset} className='btn btn-primary'>
						Réessayer
					</button>
					<Link href='/' className='btn btn-secondary'>
						Retour à l’accueil
					</Link>
				</div>

				{error?.digest ? (
					<p className={styles.reference}>
						Si le problème persiste, donnez-nous cette référence :{' '}
						<code className={styles.digest}>{error.digest}</code>
					</p>
				) : null}
			</div>
		</section>
	);
}
