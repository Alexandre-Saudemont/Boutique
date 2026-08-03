import {Lock} from 'lucide-react';
import {formatPrix, formatPrixCompact} from '@/lib/format';
import styles from './CartSummary.module.css';

/* Récapitulatif de commande — panier, livraison, paiement.

   Le même bloc suit le visiteur sur les quatre étapes du tunnel : les montants
   changent, la présentation non. Il ne calcule rien lui-même, il affiche ce que
   le service a calculé — c'est ce qui garantit que le total du panier et celui
   du paiement ne peuvent pas diverger.

   `action` est le bouton de l'étape : un lien tant qu'il n'y a rien à valider,
   un vrai bouton quand il déclenchera un paiement. */

export default function CartSummary({panier, livraisonCents = null, action}) {
	const {sousTotalCents, franco} = panier;

	// Livraison encore inconnue à l'étape panier : elle dépend du mode et de
	// l'adresse, choisis à l'étape suivante.
	const livraisonConnue = typeof livraisonCents === 'number';
	const livraisonOfferte = livraisonConnue && livraisonCents === 0;
	const totalCents = sousTotalCents + (livraisonConnue ? livraisonCents : 0);

	return (
		<aside className={styles.recap} aria-label='Récapitulatif'>
			<h2 className={styles.titre}>Récapitulatif</h2>

			<div className={styles.lignes}>
				<div className={styles.ligne}>
					<span className={styles.libelle}>Sous-total</span>
					<span className={styles.valeur}>{formatPrix(sousTotalCents)}</span>
				</div>

				<div className={styles.ligne}>
					<span className={styles.libelle}>Livraison</span>
					<span
						className={`${styles.valeur} ${livraisonOfferte ? styles.valeurOfferte : ''}`}>
						{livraisonConnue
							? livraisonOfferte
								? 'Offerte'
								: formatPrix(livraisonCents)
							: 'À l’étape suivante'}
					</span>
				</div>
			</div>

			{franco.seuilCents > 0 &&
				(franco.atteint ? (
					<p className={styles.indice}>
						Livraison offerte — vous avez dépassé{' '}
						{formatPrixCompact(franco.seuilCents)}.
					</p>
				) : (
					sousTotalCents > 0 && (
						<p className={styles.indice}>
							Plus que {formatPrix(franco.resteCents)} pour la livraison offerte.
						</p>
					)
				))}

			<div className={styles.separateur} />

			<div className={styles.total}>
				<span className={styles.totalLibelle}>Total</span>
				<span className={styles.totalValeur}>{formatPrix(totalCents)}</span>
			</div>

			{action}

			<div className={styles.mentionSecurite}>
				<Lock size={13} strokeWidth={2.75} />
				Paiement 100 % sécurisé
			</div>
		</aside>
	);
}
