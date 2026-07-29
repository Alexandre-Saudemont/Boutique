import {getRayons} from '@/server/services/categories';
import {getSetting} from '@/server/services/settings';
import HeaderClient from './HeaderClient';

/* Enveloppe serveur du header : elle lit les données, HeaderClient les affiche.

   C'est le motif à reprendre partout où un composant interactif a besoin de la
   base — on ne rend pas tout le composant serveur pour autant, et on n'ouvre
   pas non plus de route API pour aller chercher deux valeurs. */

export default async function SiteHeader() {
	const [rayons, annonce] = await Promise.all([
		getRayons(),
		getSetting('shop.announcement'),
	]);

	return <HeaderClient rayons={rayons} annonce={annonce} />;
}
