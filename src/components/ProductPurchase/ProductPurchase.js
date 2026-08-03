'use client';

import {useActionState, useState} from 'react';
import Link from 'next/link';
import {useFormStatus} from 'react-dom';
import {Check, Heart, Lock, ShoppingCart} from 'lucide-react';
import {ajouterAuPanier} from '@/app/(site)/panier/actions';
import styles from './ProductPurchase.module.css';

/* Bloc d'achat : quantité, ajout au panier, favori.

   Tant que `boutiqueOuverte` est faux, l'ajout est désactivé et porte un
   cadenas — c'est le réglage `shop.open`, modifiable depuis l'admin, qui
   commande. Le jour de l'ouverture, le client bascule le réglage et le bouton
   s'active partout sans redéploiement.

   L'ajout passe par une action serveur : c'est elle qui pose le cookie de
   panier au premier clic, borne la quantité au stock et revalide la pastille du
   header. Le retour porte la quantité réellement retenue — si le stock est
   inférieur à ce qui a été demandé, le message le dit plutôt que de laisser
   croire à un ajout complet.

   Le favori ne fait encore rien : il attend la table WishlistItem et un
   utilisateur connecté. Il est ici pour que la maquette soit complète, avec un
   état visuel local — à brancher sur une Server Action au moment des comptes. */

const QUANTITE_MAX = 9;

const ETAT_INITIAL = {statut: 'vierge'};

/* Le bouton d'envoi vit dans un composant à part : `useFormStatus` ne voit
   l'envoi que depuis un enfant du <form>. */
function BoutonAjouter() {
	const {pending} = useFormStatus();

	return (
		<button type='submit' disabled={pending} className={`btn btn-primary ${styles.ajouter}`}>
			<ShoppingCart size={17} strokeWidth={2.75} />
			{pending ? 'Un instant…' : 'Ajouter au panier'}
		</button>
	);
}

export default function ProductPurchase({produit, boutiqueOuverte = false}) {
	const [quantite, setQuantite] = useState(1);
	const [favori, setFavori] = useState(false);
	const [etat, action] = useActionState(ajouterAuPanier, ETAT_INITIAL);

	/* Le stock plafonne la quantité, sauf si la vente à découvert est autorisée
	   sur la variante (précommande, réassort permanent). */
	const plafond = produit.varianteParDefaut?.allowBackorder
		? QUANTITE_MAX
		: Math.min(QUANTITE_MAX, produit.varianteParDefaut?.stock ?? QUANTITE_MAX);

	const maximum = Math.max(1, plafond);

	return (
		<>
			<form action={action} className={styles.bloc}>
				<input
					type='hidden'
					name='varianteId'
					value={produit.varianteParDefaut?.id ?? ''}
				/>
				<input type='hidden' name='quantite' value={quantite} />
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
					<BoutonAjouter />
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
			</form>

			{etat.statut === 'ajoute' && (
				<p className={styles.confirmation} role='status'>
					<Check size={15} strokeWidth={2.75} />
					{etat.message ?? (
						<>
							Au panier.{' '}
							<Link href='/panier' className={styles.lienPanier}>
								Voir mon panier →
							</Link>
						</>
					)}
				</p>
			)}

			{etat.statut === 'erreur' && (
				<p className={styles.erreur} role='alert'>
					{etat.message}
				</p>
			)}

			{!boutiqueOuverte && (
				<Link href='/#newsletter' className={styles.lienPrevenir}>
					Prévenez-moi dès l&apos;ouverture →
				</Link>
			)}
		</>
	);
}
