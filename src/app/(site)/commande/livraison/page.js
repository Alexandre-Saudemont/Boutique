import {redirect} from 'next/navigation';
import {getCart} from '@/server/services/cart';
import {getSettings} from '@/server/services/settings';
import {getModesLivraisonPour} from '@/server/services/checkout';
import {getCartToken} from '@/server/auth/cart-session';
import {getBrouillonCommande} from '@/server/auth/checkout-session';
import CheckoutSteps from '@/components/CheckoutSteps/CheckoutSteps';
import ShippingForm from './ShippingForm';
import styles from '../commande.module.css';

/* Étape 2 : mode de livraison et adresse.

   La page vérifie deux choses avant d'afficher quoi que ce soit : la boutique
   est ouverte, et le panier n'est pas vide. Un tunnel qu'on peut parcourir sans
   panier finit toujours par produire une commande à zéro euro. */

export const metadata = {
	title: 'Livraison',
	robots: {index: false},
};

export default async function Livraison() {
	const jeton = await getCartToken();
	const [panier, reglages, brouillon] = await Promise.all([
		getCart(jeton),
		getSettings(),
		getBrouillonCommande(),
	]);

	if (!reglages['shop.open'] || panier.lignes.length === 0) {
		redirect('/panier');
	}

	const modes = await getModesLivraisonPour(panier.sousTotalCents);

	return (
		<section className={styles.page}>
			<CheckoutSteps courante='livraison' />

			<h1 className={styles.titre}>Livraison</h1>

			<ShippingForm
				panier={panier}
				modes={modes}
				brouillon={brouillon}
			/>
		</section>
	);
}
