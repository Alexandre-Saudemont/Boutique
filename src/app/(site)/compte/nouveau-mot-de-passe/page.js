import Link from 'next/link';
import ResetForm from './ResetForm';
import styles from '../compte.module.css';

/* Choix d'un nouveau mot de passe.

   Le jeton arrive par l'URL — c'est inévitable, il vient d'un lien cliqué dans
   un e-mail. Deux précautions en découlent : la page n'est pas indexable, et le
   jeton est à usage unique et de courte durée. Il ne sert qu'une fois, quelques
   secondes après avoir été reçu.

   La page ne vérifie pas le jeton avant l'envoi du formulaire : le valider ici
   le consommerait, et un antivirus qui préouvre les liens des e-mails
   invaliderait le lien avant que la personne ne l'ouvre. C'est l'action qui le
   consomme, au moment de l'enregistrement. */

export const metadata = {
	title: 'Nouveau mot de passe',
	robots: {index: false},
};

export default async function NouveauMotDePasse({searchParams}) {
	const {jeton} = await searchParams;

	return (
		<section className={styles.page}>
			<div className={styles.carteAuth}>
				<h1 className={styles.titreAuth}>Nouveau mot de passe</h1>

				{jeton ? (
					<>
						<p className={styles.texteAuth}>
							Choisissez un mot de passe d’au moins dix caractères. Une phrase que
							vous seul retenez vaut mieux qu’un mot compliqué.
						</p>

						<ResetForm jeton={String(jeton)} />
					</>
				) : (
					<>
						<p className={styles.texteAuth}>
							Ce lien est incomplet. Demandez-en un nouveau, il ne coûte rien.
						</p>

						<p className={styles.oubli}>
							<Link href='/compte/mot-de-passe-oublie'>Recevoir un nouveau lien</Link>
						</p>
					</>
				)}
			</div>
		</section>
	);
}
