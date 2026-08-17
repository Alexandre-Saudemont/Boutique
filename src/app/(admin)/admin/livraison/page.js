import {exigerDroit} from '@/server/auth/roles';
import {listerZones} from '@/server/services/shipping';
import ShippingRates from './ShippingRates';
import styles from '../../admin.module.css';

/* Frais de port.

   L'écran que le client attend le plus après le catalogue : c'est ce qui lui a
   été promis noir sur blanc dans le questionnaire — pouvoir ajuster ses tarifs
   sans me redemander.

   Les modes désactivés restent affichés, grisés : un mode retiré de la vente
   n'est jamais supprimé, parce que des commandes passées portent son nom. */

export const metadata = {title: 'Livraison'};

export default async function Livraison() {
	await exigerDroit('reglages.gerer');

	const zones = await listerZones();

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<h1 className={styles.titre}>Livraison</h1>
					<p className={styles.sousTitre}>
						Ce que voit le client au moment de choisir son envoi. Les changements
						s’appliquent tout de suite.
					</p>
				</div>
			</div>

			<div className={styles.contenu}>
				{zones.length === 0 ? (
					<div className={styles.carte}>
						<h2 className={styles.carteTitre}>Aucune zone de livraison</h2>
						<p className={styles.kpiDetail}>
							Sans zone ni mode de livraison, personne ne peut commander : le tunnel
							s’arrête à l’étape « livraison ». Commencez par créer une zone.
						</p>
					</div>
				) : null}

				<ShippingRates zones={zones} />
			</div>
		</>
	);
}
