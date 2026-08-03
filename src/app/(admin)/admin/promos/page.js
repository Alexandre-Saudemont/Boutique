import {exigerDroit} from '@/server/auth/roles';
import {listerCodes} from '@/server/services/discounts';
import PromoTable from './PromoTable';
import styles from '../../admin.module.css';

/* Codes de réduction.

   Un code désactivé n'est jamais supprimé : des commandes passées en portent le
   nom en copie, et le compteur d'utilisations reste la seule trace de ce qu'a
   donné une campagne. */

export const metadata = {title: 'Codes de réduction'};

export default async function Promos() {
	await exigerDroit('reglages.gerer');

	const promos = await listerCodes();

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<h1 className={styles.titre}>Codes de réduction</h1>
					<p className={styles.sousTitre}>
						Un seul code par commande. La livraison offerte se juge sur ce que le
						client paie réellement, après réduction.
					</p>
				</div>
			</div>

			<div className={styles.contenu}>
				<PromoTable promos={promos} />
			</div>
		</>
	);
}
