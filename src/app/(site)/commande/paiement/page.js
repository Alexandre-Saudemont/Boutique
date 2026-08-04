import {redirect} from 'next/navigation';
import {getCart} from '@/server/services/cart';
import {getSettings} from '@/server/services/settings';
import {getModeLivraison} from '@/server/services/checkout';
import {paiementEnLigneActif} from '@/server/services/payments';
import {getCartToken} from '@/server/auth/cart-session';
import {getBrouillonCommande} from '@/server/auth/checkout-session';
import {getCodePromo} from '@/server/auth/promo-session';
import CheckoutSteps from '@/components/CheckoutSteps/CheckoutSteps';
import PaymentForm from './PaymentForm';
import styles from '../commande.module.css';

/* Étape 3 : paiement.

   Aucun champ de carte bancaire ici, et ce ne sera jamais le cas : le règlement
   se fait sur la page hébergée par Stripe, où le numéro de carte ne touche
   jamais ce site. Le bouton emmène le visiteur là-bas et l'en ramène.

   Tant que les clés Stripe ne sont pas renseignées, l'écran le dit franchement —
   commande enregistrée, règlement à convenir — plutôt que de mimer un
   encaissement. */

export const metadata = {
	title: 'Paiement',
	robots: {index: false},
};

export default async function Paiement({searchParams}) {
	const parametres = await searchParams;
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

	// Sans coordonnées en brouillon, on ne peut rien facturer : retour à l'étape 2.
	// Le mode de livraison n'est exigé que s'il y a quelque chose à expédier.
	if (!brouillon?.adresse || (!panier.dematerialise && !brouillon?.rateId)) {
		redirect('/commande/livraison');
	}

	// Même base que la page précédente et que la création de commande : le
	// montant après réduction.
	const mode = panier.dematerialise
		? null
		: await getModeLivraison(brouillon.rateId, panier.totalApresReductionCents);

	if (!panier.dematerialise && !mode) {
		redirect('/commande/livraison');
	}

	return (
		<section className={styles.page}>
			<CheckoutSteps courante='paiement' />

			<h1 className={styles.titre}>Paiement</h1>

			<PaymentForm
				panier={panier}
				adresse={brouillon.adresse}
				mode={mode}
				enLigne={paiementEnLigneActif()}
				annule={parametres?.annule === '1'}
			/>
		</section>
	);
}
