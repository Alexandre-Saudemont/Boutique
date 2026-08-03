import {redirect} from 'next/navigation';
import Link from 'next/link';
import {Check} from 'lucide-react';
import {getCommande} from '@/server/services/checkout';
import {getBrouillonCommande} from '@/server/auth/checkout-session';
import {formatPrix} from '@/lib/format';
import CheckoutSteps from '@/components/CheckoutSteps/CheckoutSteps';
import styles from '../commande.module.css';

/* Étape 4 : confirmation.

   Le numéro de commande et l'e-mail viennent du cookie, jamais de l'URL : une
   adresse e-mail dans une barre d'adresse finit dans les journaux du serveur,
   l'historique du navigateur et le `Referer` envoyé aux tiers.

   La page est volontairement sans effet de bord — on peut la recharger sans
   recréer quoi que ce soit. */

export const metadata = {
	title: 'Commande enregistrée',
	robots: {index: false},
};

export default async function Confirmation() {
	const brouillon = await getBrouillonCommande();
	const reference = brouillon?.commande;

	if (!reference) {
		redirect('/panier');
	}

	const commande = await getCommande(reference.numero, reference.email);

	if (!commande) {
		redirect('/panier');
	}

	return (
		<section className={styles.page}>
			<CheckoutSteps courante='confirmation' />

			<div className={styles.confirmation}>
				<span className={styles.confirmationIcone}>
					<Check size={32} strokeWidth={3} />
				</span>

				<h1 className={styles.confirmationTitre}>Merci — c&apos;est noté.</h1>

				<p className={styles.confirmationTexte}>
					Votre commande est enregistrée sous la référence{' '}
					<strong className={styles.numero}>{commande.orderNumber}</strong>. Un
					récapitulatif part à l&apos;adresse {commande.email}.
				</p>

				<div className={styles.enAttente}>
					<strong>Le paiement reste à faire.</strong> L&apos;encaissement en ligne
					n&apos;est pas encore ouvert : je vous recontacte pour finaliser. Rien
					n&apos;a été débité.
				</div>

				<dl className={styles.resume}>
					<div className={styles.resumeLigne}>
						<dt>Articles</dt>
						<dd>{formatPrix(commande.subtotalCents)}</dd>
					</div>
					<div className={styles.resumeLigne}>
						<dt>{commande.shippingMethod}</dt>
						<dd>
							{commande.shippingCents === 0
								? 'Offerte'
								: formatPrix(commande.shippingCents)}
						</dd>
					</div>
					<div className={`${styles.resumeLigne} ${styles.resumeTotal}`}>
						<dt>Total</dt>
						<dd>{formatPrix(commande.totalCents)}</dd>
					</div>
				</dl>

				<div className={styles.confirmationBoutons}>
					<Link href='/boutique' className='btn btn-primary' style={{padding: '12px 24px'}}>
						Retour à la boutique
					</Link>
				</div>
			</div>
		</section>
	);
}
