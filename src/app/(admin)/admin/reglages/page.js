import {exigerDroit} from '@/server/auth/roles';
import {REGLAGES_MODIFIABLES, getSettings} from '@/server/services/settings';
import SettingsForm from './SettingsForm';
import styles from '../../admin.module.css';

/* Réglages d'exploitation.

   Ce qui doit pouvoir changer sans me rappeler : le seuil de franco de port, le
   bandeau d'annonce, l'ouverture de la boutique. Tout ce qui est ici est en
   base et prend effet immédiatement.

   Les moyens de paiement n'y figurent pas : ils dépendent des clés Stripe, qui
   vivent dans les variables d'environnement du serveur. Un réglage qui promet
   d'activer PayPal sans que les clés existent ne ferait qu'induire en erreur. */

export const metadata = {title: 'Réglages'};

export default async function Reglages() {
	await exigerDroit('reglages.gerer');

	const valeurs = await getSettings();

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<h1 className={styles.titre}>Réglages</h1>
					<p className={styles.sousTitre}>
						Ces valeurs s’appliquent au site tout de suite après enregistrement.
					</p>
				</div>
			</div>

			<div className={styles.contenu}>
				<SettingsForm descripteurs={REGLAGES_MODIFIABLES} valeurs={valeurs} />
			</div>
		</>
	);
}
