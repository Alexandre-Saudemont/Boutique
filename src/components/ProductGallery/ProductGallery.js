'use client';

import {useState} from 'react';
import Image from 'next/image';
import styles from './ProductGallery.module.css';

/* Galerie de la fiche produit : une image principale et ses miniatures.

   Toutes les images sont dans le DOM et on masque les inactives, plutôt que de
   remplacer la source de la principale : le navigateur les a déjà chargées, le
   changement de vue est donc instantané au lieu de laisser un cadre vide le
   temps du téléchargement. Sur quatre visuels, le surcoût est négligeable.

   Sans photo, on affiche l'initiale du produit sur un aplat — le catalogue du
   client n'est pas encore illustré, et un cadre cassé serait pire que rien. */

export default function ProductGallery({images, nom, badge}) {
	const [active, setActive] = useState(0);

	if (images.length === 0) {
		return (
			<div className={styles.galerie}>
				<div className={styles.principale}>
					{badge && <span className={`tag tag-accent ${styles.badge}`}>{badge}</span>}
					<span className={styles.emplacement}>{nom.charAt(0)}</span>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.galerie}>
			<div className={styles.principale}>
				{badge && <span className={`tag tag-accent ${styles.badge}`}>{badge}</span>}

				{images.map((image, index) => (
					<div
						key={image.id}
						style={{
							position: 'absolute',
							inset: 0,
							display: index === active ? 'block' : 'none',
						}}>
						<Image
							src={image.url}
							alt={image.alt ?? `${nom} — vue ${index + 1}`}
							fill
							sizes='(max-width: 900px) 100vw, 560px'
							// La première image est le plus gros visuel de la page :
							// la charger en priorité améliore directement le LCP.
							priority={index === 0}
							className={`${styles.image} washed`}
						/>
					</div>
				))}
			</div>

			{images.length > 1 && (
				<div className={styles.miniatures}>
					{images.map((image, index) => (
						<button
							key={image.id}
							type='button'
							onClick={() => setActive(index)}
							className={`${styles.miniature} ${
								index === active ? styles.miniatureActive : ''
							}`}
							aria-label={`Voir la vue ${index + 1}`}
							aria-pressed={index === active}>
							<Image
								src={image.url}
								alt=''
								fill
								sizes='140px'
								className={`${styles.miniatureImage} washed`}
							/>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
