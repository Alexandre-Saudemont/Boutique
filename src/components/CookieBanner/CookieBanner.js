'use client';

import {useSyncExternalStore} from 'react';
import Link from 'next/link';
import styles from './CookieBanner.module.css';

/* Le bandeau cookies.

   **Il informe, il ne demande pas un consentement.** Le site ne pose que quatre
   cookies, tous strictement nécessaires (`session`, `panier`, `commande`,
   `promo`) — cette catégorie est dispensée de consentement. Un bouton
   « Refuser » qui ne refuserait rien, ou un « Personnaliser » sans rien à
   régler, serait un faux : le visiteur croirait avoir arbitré quelque chose, et
   la boutique afficherait une conformité qu'elle n'a pas eu à obtenir. D'où un
   seul bouton, qui ne fait que ce qu'il annonce — fermer.

   **Le jour où un traceur arrive** (mesure d'audience, pixel publicitaire,
   vidéo embarquée), ce composant ne suffit plus : il faudra un vrai refus, qui
   bloque le dépôt *avant* qu'il ait lieu, et un moyen de revenir sur son choix.
   Ce n'est pas un bouton à ajouter ici, c'est un mécanisme à construire. C'est
   écrit là pour qu'on ne se contente pas de renommer celui-ci.

   Le choix est retenu dans `localStorage` et non dans un cookie : ajouter un
   cinquième cookie pour dire qu'on en pose quatre serait un comble, et la liste
   publiée sur /legal resterait à jour toute seule. */

const CLE = 'antre.cookies.vu';

/* `localStorage` est un état qui vit hors de React, et que le serveur ne peut
   pas connaître : c'est précisément ce que `useSyncExternalStore` sait lire
   sans provoquer d'écart entre le HTML rendu au serveur et l'hydratation. */
const ecouteurs = new Set();

function souscrire(rappel) {
	ecouteurs.add(rappel);

	return () => ecouteurs.delete(rappel);
}

function etatLocal() {
	try {
		return window.localStorage.getItem(CLE) === '1' ? 'ferme' : 'ouvert';
	} catch {
		/* Navigation privée, stockage bloqué : on affiche le bandeau, refermable
		   pour la page en cours. Mieux vaut le montrer une fois de trop que de
		   faire échouer le rendu pour un bandeau d'information. */
		return 'ouvert';
	}
}

/* Au serveur, le bandeau n'existe pas.

   C'est ce qui évite qu'il apparaisse une fraction de seconde chez quelqu'un
   qui l'a déjà fermé — l'effet le plus agaçant qu'un bandeau puisse produire.
   Il coûte en échange une image légèrement décalée à la première visite,
   pendant l'hydratation ; c'est le bon côté du compromis. */
function etatServeur() {
	return 'ferme';
}

function fermer() {
	try {
		window.localStorage.setItem(CLE, '1');
	} catch {
		// Rien à faire : le bandeau se referme quand même pour la page en cours.
	}

	for (const rappel of ecouteurs) rappel();
}

export default function CookieBanner() {
	const etat = useSyncExternalStore(souscrire, etatLocal, etatServeur);

	if (etat === 'ferme') return null;

	return (
		/* `role="region"` plutôt que `dialog` : le bandeau ne bloque rien et ne
		   capture pas le clavier. L'annoncer comme une boîte de dialogue ferait
		   croire à un lecteur d'écran qu'il faut le traiter pour continuer. */
		<div className={styles.bandeau} role='region' aria-label='Information sur les cookies'>
			<p className={styles.texte}>
				Ce site ne dépose que les cookies nécessaires à son fonctionnement — votre panier et votre
				connexion. Aucune mesure d&apos;audience, aucune publicité, rien qui parte chez un tiers.{' '}
				<Link href='/legal#cookies'>Voir le détail</Link>.
			</p>

			<div className={styles.actions}>
				<button
					type='button'
					onClick={fermer}
					className='btn btn-primary'
					style={{padding: '10px 22px', fontSize: 14.5}}>
					J&apos;ai compris
				</button>
			</div>
		</div>
	);
}
