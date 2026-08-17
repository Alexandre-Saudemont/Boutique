import Link from 'next/link';
import Image from 'next/image';
import {Lock} from 'lucide-react';
import {formatPrix} from '@/lib/format';
import {ETAT_BOX, ETAT_NUMERIQUE, ETATS} from '@/lib/catalogue';
import styles from './ProductCard.module.css';

/* Carte produit — boutique, résultats de recherche, favoris, « même rayon ».

   Elle ne lit rien elle-même : le produit lui arrive déjà mis en forme par le
   service. C'est ce qui lui permet de rester un composant serveur sans état, et
   d'être réutilisée partout sans traîner de requête avec elle.

   Tant que la boutique n'est pas ouverte, le bouton d'achat est désactivé et
   porte un cadenas — l'inventaire se visite, il ne s'achète pas encore. */

/* Le badge d'état reprend les classes du design system : terracotta pour le
   neuf, sauge pour la précommande et les box, contour pour l'occasion.

   Le repli n'est pas décoratif : les états hors catalogue (numérique, box) ne
   sont pas dans `ETATS`, et sans lui la classe valait `undefined` — le badge
   perdait alors sa couleur de fond et se lisait à peine. */
const CLASSE_BADGE = {
	[ETATS.NEUF]: 'tag-accent',
	[ETATS.PRECOMMANDE]: 'tag-accent-2',
	[ETATS.OCCASION]: 'tag-outline',
	[ETAT_NUMERIQUE.cle]: 'tag-neutral',
	[ETAT_BOX.cle]: 'tag-accent-2',
};

export default function ProductCard({produit, boutiqueOuverte = false}) {
	const href = `/produit/${produit.slug}`;

	return (
		<article className={styles.carte}>
			<Link href={href} className={styles.visuel} tabIndex={-1} aria-hidden='true'>
				{produit.image ? (
					/* `sizes` décrit la largeur réelle de la vignette selon le
					   viewport — sans lui, Next servirait la pleine largeur d'écran
					   à une carte qui fait un tiers de colonne. Les valeurs suivent
					   les points de rupture de la grille (3 colonnes, puis 2, puis 1). */
					<Image
						src={produit.image.url}
						alt={produit.image.alt ?? ''}
						fill
						sizes='(max-width: 560px) 100vw, (max-width: 900px) 50vw, 300px'
						className={`${styles.image} washed`}
					/>
				) : (
					<span className={styles.emplacement}>{produit.nom.charAt(0)}</span>
				)}

				<span
					className={`tag ${CLASSE_BADGE[produit.etat.cle] ?? 'tag-neutral'} ${styles.badge}`}>
					{produit.etat.libelle}
				</span>
			</Link>

			<div className={styles.corps}>
				{produit.rayon && <span className={styles.rayon}>{produit.rayon}</span>}

				{/* Le titre porte le seul lien annoncé : le visuel au-dessus mène au
				    même endroit, le répéter ferait lire deux fois la même
				    destination à un lecteur d'écran. */}
				<h3 className={styles.nom}>
					<Link href={href}>{produit.nom}</Link>
				</h3>

				{produit.accroche && <p className={styles.accroche}>{produit.accroche}</p>}

				<div className={styles.pied}>
					<span className={styles.prix}>
						{produit.aPartirDe && <span className={styles.aPartirDe}>dès</span>}
						{formatPrix(produit.prixCents)}
						{produit.prixBarreCents > produit.prixCents && (
							<span className={styles.prixBarre}>
								{formatPrix(produit.prixBarreCents)}
							</span>
						)}
					</span>

					{boutiqueOuverte ? (
						<Link href={href} className='btn btn-secondary' style={{fontSize: 12.5}}>
							Voir
						</Link>
					) : (
						<button
							type='button'
							disabled
							className={styles.bouton}
							aria-label={`${produit.nom} — bientôt disponible`}>
							<Lock size={13} strokeWidth={2.75} />
							Bientôt
						</button>
					)}
				</div>
			</div>
		</article>
	);
}
