import Link from 'next/link';
import {Check, X} from 'lucide-react';
import {verifierEmail} from '@/server/services/accounts';
import styles from '../compte.module.css';

/* Vérification de l'adresse e-mail.

   Comme pour la newsletter : la vérification se fait au chargement, sans bouton
   à cliquer. Le visiteur a déjà agi en ouvrant le lien de son e-mail.

   Ce que la vérification apporte concrètement : la certitude que l'adresse de
   suivi des commandes est bien la sienne et qu'elle fonctionne. Elle ne
   conditionne aucun achat — exiger une adresse vérifiée avant de vendre ferait
   perdre des commandes sans rien protéger de sérieux. */

export const metadata = {
	title: 'Vérification de l’adresse',
	robots: {index: false},
};

export default async function Verification({searchParams}) {
	const {jeton} = await searchParams;

	const resultat = await verifierEmail(jeton);

	return (
		<section className={styles.page}>
			<div className={styles.carteAuth}>
				<span className={styles.iconeMail}>
					{resultat.ok ? <Check size={28} strokeWidth={3} /> : <X size={28} strokeWidth={3} />}
				</span>

				{resultat.ok ? (
					<>
						<h1 className={styles.titreAuth}>Adresse confirmée</h1>
						<p className={styles.texteAuth}>
							Merci ! C’est à cette adresse que partiront vos confirmations de
							commande et vos suivis de colis.
						</p>
					</>
				) : (
					<>
						<h1 className={styles.titreAuth}>Ce lien n’est plus valable</h1>
						<p className={styles.texteAuth}>
							Il a peut-être déjà servi, ou dépassé ses 24 heures. Votre compte
							fonctionne normalement — vous pouvez commander sans avoir confirmé.
						</p>
					</>
				)}

				<p className={styles.oubli}>
					<Link href='/compte'>Aller à mon compte</Link>
				</p>
			</div>
		</section>
	);
}
