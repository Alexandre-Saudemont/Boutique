import Link from 'next/link';
import {ArrowLeft, Bot, ShoppingCart} from 'lucide-react';
import {getCart} from '@/server/services/cart';
import {getSettings} from '@/server/services/settings';
import {getCartToken} from '@/server/auth/cart-session';
import {getCodePromo} from '@/server/auth/promo-session';
import {pluriel} from '@/lib/format';
import CartLine from '@/components/CartLine/CartLine';
import CartSummary from '@/components/CartSummary/CartSummary';
import PromoCode from '@/components/PromoCode/PromoCode';
import CheckoutSteps from '@/components/CheckoutSteps/CheckoutSteps';
import styles from './panier.module.css';

/* Le panier — première des quatre étapes du tunnel.

   La page lit le cookie mais ne l'écrit jamais : c'est l'ajout au panier qui
   crée le jeton. Un visiteur qui arrive ici sans avoir rien ajouté voit l'état
   vide, sans qu'une ligne soit créée en base.

   Livraison et paiement suivront ; le stepper les annonce déjà pour que le
   visiteur sache combien d'étapes l'attendent. */

export const metadata = {
	title: 'Votre panier',
	robots: {index: false},
};

export default async function Panier() {
	const jeton = await getCartToken();
	const code = await getCodePromo();
	const [panier, reglages] = await Promise.all([getCart(jeton, code), getSettings()]);

	const boutiqueOuverte = Boolean(reglages['shop.open']);
	const vide = panier.lignes.length === 0;

	return (
		<section className={styles.page}>
			{!boutiqueOuverte && (
				<div className={styles.avis}>
					<Bot size={20} strokeWidth={2.5} className={styles.avisIcone} />
					<p className={styles.avisTexte}>
						<strong>Boutique en construction.</strong> Voici un aperçu du futur panier —
						aucune commande n&apos;est possible pour l&apos;instant.{' '}
						<Link href='/#newsletter' className={styles.avisLien}>
							Prévenez-moi de l&apos;ouverture →
						</Link>
					</p>
				</div>
			)}

			<CheckoutSteps courante='panier' />

			<h1 className={styles.titre}>Votre panier</h1>

			{vide ? (
				<div className={styles.vide}>
					<span className={styles.videIcone}>
						<ShoppingCart size={32} strokeWidth={2.5} />
					</span>
					<h2 className={styles.videTitre}>Votre panier est vide</h2>
					<p className={styles.videTexte}>
						Il reste de la place sur les étagères — allez fouiller.
					</p>
					<Link href='/boutique' className='btn btn-primary' style={{padding: '12px 24px'}}>
						Explorer la boutique
					</Link>
				</div>
			) : (
				<div className={styles.colonnes}>
					<div className={styles.lignes}>
						<p className={styles.nombre}>
							{pluriel(panier.nombreArticles, 'article', 'articles')} au panier
						</p>

						{panier.lignes.map((ligne) => (
							<CartLine key={ligne.id} ligne={ligne} />
						))}

						<Link href='/boutique' className={styles.continuer}>
							<ArrowLeft size={16} strokeWidth={2.75} />
							Continuer mes achats
						</Link>
					</div>

					<CartSummary
						panier={panier}
						codePromo={<PromoCode promo={panier.promo} />}
						action={
							boutiqueOuverte ? (
								<Link
									href='/commande/livraison'
									className='btn btn-primary btn-block'
									style={{padding: 13, fontSize: 15}}>
									Passer à la livraison
								</Link>
							) : (
								/* Boutique fermée : la suite du tunnel refuserait de toute
								   façon, autant le dire ici plutôt qu'à l'étape suivante. */
								<button
									type='button'
									disabled
									className='btn btn-primary btn-block'
									style={{padding: 13, fontSize: 15}}>
									Commande à l&apos;ouverture
								</button>
							)
						}
					/>
				</div>
			)}
		</section>
	);
}
