'use client';

import {useState} from 'react';
import Link from 'next/link';
import {Heart, Lock, ShoppingCart} from 'lucide-react';
import styles from './ProductPurchase.module.css';

/* Bloc d'achat : quantité, ajout au panier, favori.

   Tant que `boutiqueOuverte` est faux, l'ajout est désactivé et porte un
   cadenas — c'est le réglage `shop.open`, modifiable depuis l'admin, qui
   commande. Le jour de l'ouverture, le client bascule le réglage et le bouton
   s'active partout sans redéploiement.

   Le favori ne fait encore rien : il attend la table WishlistItem et un
   utilisateur connecté. Il est ici pour que la maquette soit complète, avec un
   état visuel local — à brancher sur une Server Action au moment des comptes. */

const QUANTITE_MAX = 9;

export default function ProductPurchase({produit, boutiqueOuverte = false}) {
	const [quantite, setQuantite] = useState(1);
	const [favori, setFavori] = useState(false);

	/* Le stock plafonne la quantité, sauf si la vente à découvert est autorisée
	   sur la variante (précommande, réassort permanent). */
	const plafond = produit.varianteParDefaut?.allowBackorder
		? QUANTITE_MAX
		: Math.min(QUANTITE_MAX, produit.varianteParDefaut?.stock ?? QUANTITE_MAX);

	const maximum = Math.max(1, plafond);

	return (
		<>
			<div className={styles.bloc}>
				<div className={styles.quantite}>
					<button
						type='button'
						onClick={() => setQuantite((valeur) => Math.max(valeur - 1, 1))}
						disabled={quantite <= 1}
						className={styles.pas}
						aria-label='Diminuer la quantité'>
						−
					</button>

					{/* aria-live : au clavier, le nombre change sans que le focus
					    bouge — sans annonce, rien ne signale le changement. */}
					<span className={styles.valeur} aria-live='polite'>
						{quantite}
					</span>

					<button
						type='button'
						onClick={() => setQuantite((valeur) => Math.min(valeur + 1, maximum))}
						disabled={quantite >= maximum}
						className={styles.pas}
						aria-label='Augmenter la quantité'>
						+
					</button>
				</div>

				{boutiqueOuverte ? (
					<button type='button' className={`btn btn-primary ${styles.ajouter}`}>
						<ShoppingCart size={17} strokeWidth={2.75} />
						Ajouter au panier
					</button>
				) : (
					<button
						type='button'
						disabled
						className={`${styles.ajouter} ${styles.ajouterFerme}`}>
						<Lock size={17} strokeWidth={2.75} />
						Ajout au panier à l&apos;ouverture
					</button>
				)}

				<button
					type='button'
					onClick={() => setFavori((valeur) => !valeur)}
					className={`btn btn-secondary btn-icon ${styles.favori}`}
					aria-label={favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
					aria-pressed={favori}>
					<Heart
						size={20}
						strokeWidth={2.4}
						fill={favori ? 'var(--color-accent)' : 'none'}
					/>
				</button>
			</div>

			{!boutiqueOuverte && (
				<Link href='/#newsletter' className={styles.lienPrevenir}>
					Prévenez-moi dès l&apos;ouverture →
				</Link>
			)}
		</>
	);
}
