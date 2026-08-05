import {getRayons} from '@/server/services/categories';
import {getTaillesBox, listerBoxes} from '@/server/services/boxes';
import {getSetting} from '@/server/services/settings';
import {countCartItems} from '@/server/services/cart';
import {getCartToken} from '@/server/auth/cart-session';
import {getUtilisateurCourant} from '@/server/auth/session';
import {formatPrixCompact} from '@/lib/format';
import HeaderClient from './HeaderClient';

/* Enveloppe serveur du header : elle lit les données, HeaderClient les affiche.

   C'est le motif à reprendre partout où un composant interactif a besoin de la
   base — on ne rend pas tout le composant serveur pour autant, et on n'ouvre
   pas non plus de route API pour aller chercher deux valeurs.

   La pastille du panier lit le cookie, ce qui rend dynamique tout ce qui passe
   par le layout de la vitrine — le `revalidate` du layout ne s'applique plus.
   C'est le prix d'un compteur juste : un header mis en cache afficherait le
   panier du visiteur précédent. Si la charge le demande un jour, la sortie est
   le PPR — le header en statique, la seule pastille en trou dynamique. */

export default async function SiteHeader() {
	const jeton = await getCartToken();

	const [rayons, boxes, taillesBox, annonce, articlesAuPanier, utilisateur] = await Promise.all([
		getRayons(),
		listerBoxes(),
		getTaillesBox(),
		getSetting('shop.announcement'),
		countCartItems(jeton),
		getUtilisateurCourant(),
	]);

	/* Seul le strict nécessaire à l'affichage descend au navigateur : un prénom
	   et une initiale. Passer l'objet utilisateur entier enverrait son rôle et
	   ses dates dans le HTML de chaque page. */
	const compte = utilisateur
		? {
				prenom: utilisateur.firstName ?? null,
				initiale: (utilisateur.firstName ?? utilisateur.email).charAt(0).toUpperCase(),
			}
		: null;

	return (
		<HeaderClient
			rayons={rayons}
			/* Seuls le nom et le slug partent au navigateur : le menu n'a pas
			   besoin du stock ni des images de chaque box. */
			boxes={boxes.map((box) => ({nom: box.nom, slug: box.slug}))}
			taillesBox={taillesBox.map((taille) => ({
				nom: taille.nom,
				prix: formatPrixCompact(taille.prixCents),
			}))}
			annonce={annonce}
			articlesAuPanier={articlesAuPanier}
			compte={compte}
		/>
	);
}
