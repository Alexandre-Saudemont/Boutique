'use client';

import {useState} from 'react';
import styles from './ProductTabs.module.css';

/* Onglets Description / Caractéristiques / Livraison.

   Les trois contenus arrivent déjà construits par la page : ce composant ne
   gère que le basculement. Les caractéristiques sont dérivées des vraies
   données du produit (matière, dimensions, référence, options de variante), pas
   d'un texte libre — c'est ce qui permet au client de les remplir depuis
   l'admin sans écrire de HTML.

   Balisage ARIA d'onglets complet : sans role/aria-controls, un lecteur d'écran
   annonce trois boutons sans rapport avec le contenu qui change dessous. */

export default function ProductTabs({description, caracteristiques, livraison}) {
	const [actif, setActif] = useState('description');

	const onglets = [
		{cle: 'description', libelle: 'Description'},
		{cle: 'caracteristiques', libelle: 'Caractéristiques'},
		{cle: 'livraison', libelle: 'Livraison'},
	];

	return (
		<div>
			<div className={styles.onglets} role='tablist' aria-label='Détails du produit'>
				{onglets.map((onglet) => (
					<button
						key={onglet.cle}
						type='button'
						role='tab'
						id={`onglet-${onglet.cle}`}
						aria-selected={actif === onglet.cle}
						aria-controls={`panneau-${onglet.cle}`}
						onClick={() => setActif(onglet.cle)}
						className={`${styles.onglet} ${
							actif === onglet.cle ? styles.ongletActif : ''
						}`}>
						{onglet.libelle}
					</button>
				))}
			</div>

			{actif === 'description' && (
				<div
					role='tabpanel'
					id='panneau-description'
					aria-labelledby='onglet-description'
					className={styles.contenu}>
					{description ? (
						description
							.split('\n')
							.filter(Boolean)
							.map((paragraphe, index) => <p key={index}>{paragraphe}</p>)
					) : (
						<p>La description de cette pièce arrive bientôt.</p>
					)}
				</div>
			)}

			{actif === 'caracteristiques' && (
				<div
					role='tabpanel'
					id='panneau-caracteristiques'
					aria-labelledby='onglet-caracteristiques'>
					{caracteristiques.length > 0 ? (
						caracteristiques.map((ligne) => (
							<div key={ligne.cle} className={styles.ligne}>
								<span className={styles.cle}>{ligne.cle}</span>
								<span className={styles.valeur}>{ligne.valeur}</span>
							</div>
						))
					) : (
						<p className={styles.contenu}>
							Les caractéristiques de cette pièce ne sont pas encore renseignées.
						</p>
					)}
				</div>
			)}

			{actif === 'livraison' && (
				<div
					role='tabpanel'
					id='panneau-livraison'
					aria-labelledby='onglet-livraison'
					className={styles.contenu}>
					{livraison}
				</div>
			)}
		</div>
	);
}
