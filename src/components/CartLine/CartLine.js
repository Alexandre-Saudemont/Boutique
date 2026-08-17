'use client';

import {useTransition} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {Trash2} from 'lucide-react';
import {changerQuantite, retirerDuPanier} from '@/app/(site)/panier/actions';
import {formatPrix} from '@/lib/format';
import {ETATS} from '@/lib/catalogue';
import styles from './CartLine.module.css';

/* Une ligne du panier.

   Elle est cliente pour une seule raison : `useTransition`, qui grise la ligne
   pendant que le serveur enregistre. Sans lui, un « + » cliqué deux fois vite
   part deux fois avec la même quantité de départ, et la seconde écrase la
   première.

   Le calcul reste au serveur : le bouton envoie la quantité voulue, c'est le
   service qui la borne au stock et renvoie l'état vrai. Une addition optimiste
   côté navigateur afficherait « 4 » sur une variante qui n'en a que 3. */

const CLASSE_BADGE = {
	[ETATS.NEUF]: 'tag-accent',
	[ETATS.PRECOMMANDE]: 'tag-accent-2',
	[ETATS.OCCASION]: 'tag-outline',
};

export default function CartLine({ligne}) {
	const [enCours, demarrer] = useTransition();

	const definirQuantite = (valeur) => {
		demarrer(() => changerQuantite(ligne.id, valeur));
	};

	return (
		<article className={styles.ligne} data-occupe={enCours || undefined}>
			<Link href={`/produit/${ligne.slug}`} className={styles.visuel} aria-hidden='true' tabIndex={-1}>
				{ligne.image ? (
					<Image
						src={ligne.image.url}
						alt=''
						fill
						sizes='84px'
						className={`${styles.image} washed`}
					/>
				) : (
					<span className={styles.emplacement}>{ligne.nom.charAt(0)}</span>
				)}
			</Link>

			<div className={styles.infos}>
				{ligne.rayon && <span className={styles.rayon}>{ligne.rayon}</span>}

				<h3 className={styles.nom}>
					<Link href={`/produit/${ligne.slug}`}>{ligne.nom}</Link>
				</h3>

				{ligne.variante && <span className={styles.variante}>{ligne.variante}</span>}

				<span className={`tag ${CLASSE_BADGE[ligne.etat.cle]} ${styles.badge}`}>
					{ligne.etat.libelle}
				</span>
			</div>

			<div className={styles.cote}>
				<span className={styles.total}>{formatPrix(ligne.totalLigneCents)}</span>

				<div className={styles.quantite}>
					<button
						type='button'
						onClick={() => definirQuantite(ligne.quantite - 1)}
						disabled={enCours}
						className={styles.pas}
						aria-label={`Retirer une unité de ${ligne.nom}`}>
						−
					</button>

					<span className={styles.valeur} aria-live='polite'>
						{ligne.quantite}
					</span>

					<button
						type='button'
						onClick={() => definirQuantite(ligne.quantite + 1)}
						disabled={enCours || ligne.quantite >= ligne.maximum}
						className={styles.pas}
						aria-label={`Ajouter une unité de ${ligne.nom}`}>
						+
					</button>
				</div>

				<button
					type='button'
					onClick={() => demarrer(() => retirerDuPanier(ligne.id))}
					disabled={enCours}
					className={styles.retirer}>
					<Trash2 size={13} strokeWidth={2.75} />
					Retirer
				</button>
			</div>
		</article>
	);
}
