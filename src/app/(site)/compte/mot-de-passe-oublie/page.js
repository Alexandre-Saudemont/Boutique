import Link from 'next/link';
import ForgotForm from './ForgotForm';
import styles from '../compte.module.css';

/* Mot de passe oublié.

   Un seul champ, et une réponse invariable : « si un compte existe à cette
   adresse, un lien vient de partir ». Ni confirmation ni démenti — ce
   formulaire est public, et distinguer les deux cas en ferait un moyen de
   savoir qui est client de la boutique. */

export const metadata = {
	title: 'Mot de passe oublié',
	robots: {index: false},
};

export default function MotDePasseOublie() {
	return (
		<section className={styles.page}>
			<div className={styles.carteAuth}>
				<h1 className={styles.titreAuth}>Mot de passe oublié</h1>

				<p className={styles.texteAuth}>
					Indiquez votre adresse : je vous envoie un lien pour en choisir un nouveau.
				</p>

				<ForgotForm />

				<p className={styles.oubli}>
					<Link href='/compte'>Revenir à la connexion</Link>
				</p>
			</div>
		</section>
	);
}
