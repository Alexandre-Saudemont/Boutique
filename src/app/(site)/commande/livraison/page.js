import {redirect} from 'next/navigation';
import {getCart} from '@/server/services/cart';
import {getSettings} from '@/server/services/settings';
import {getModesLivraisonPour} from '@/server/services/checkout';
import {getCartToken} from '@/server/auth/cart-session';
import {getBrouillonCommande} from '@/server/auth/checkout-session';
import {getCodePromo} from '@/server/auth/promo-session';
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
	const code = await getCodePromo();
	const [panier, reglages, brouillon] = await Promise.all([
		getCart(jeton, code),
		getSettings(),
		getBrouillonCommande(),
	]);

	if (!reglages['shop.open'] || panier.lignes.length === 0) {
		redirect('/panier');
	}

	/* Le franco de port se juge sur le montant après réduction — ce que le
	   client paie réellement. `totalApresReductionCents` porte cette valeur ;
	   passer le sous-total brut ici offrirait la livraison sur un panier retombé
	   sous le seuil. */
	const modes = await getModesLivraisonPour(panier.totalApresReductionCents);

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
