import {redirect} from 'next/navigation';
import {getCart} from '@/server/services/cart';
import {getSettings} from '@/server/services/settings';
import {getModeLivraison} from '@/server/services/checkout';
import {getCartToken} from '@/server/auth/cart-session';
import {getBrouillonCommande} from '@/server/auth/checkout-session';
import CheckoutSteps from '@/components/CheckoutSteps/CheckoutSteps';
import PaymentForm from './PaymentForm';
import styles from '../commande.module.css';

/* Étape 3 : paiement.

   Ni Stripe ni PayPal ne sont branchés — il manque les comptes et les clés. La
   commande est donc bien créée, avec son paiement en attente, mais rien n'est
   débité. L'écran le dit franchement plutôt que de mimer un encaissement : un
   faux formulaire de carte bancaire apprend au visiteur à taper son numéro dans
   n'importe quel champ qui y ressemble. */

export const metadata = {
	title: 'Paiement',
	robots: {index: false},
};

export default async function Paiement() {
	const jeton = await getCartToken();
	const [panier, reglages, brouillon] = await Promise.all([
		getCart(jeton),
		getSettings(),
		getBrouillonCommande(),
	]);

	if (!reglages['shop.open'] || panier.lignes.length === 0) {
		redirect('/panier');
	}

	// Sans adresse en brouillon, on ne peut rien facturer : retour à l'étape 2.
	if (!brouillon?.adresse || !brouillon?.rateId) {
		redirect('/commande/livraison');
	}

	const mode = await getModeLivraison(brouillon.rateId, panier.sousTotalCents);

	if (!mode) {
		redirect('/commande/livraison');
	}

	return (
		<section className={styles.page}>
			<CheckoutSteps courante='paiement' />

			<h1 className={styles.titre}>Paiement</h1>

			<PaymentForm panier={panier} adresse={brouillon.adresse} mode={mode} />
		</section>
	);
}
