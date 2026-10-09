import {exigerDroit} from '@/server/auth/roles';
import {listerMascottes} from '@/server/services/mascottes';
import MascotteGestion from './MascotteGestion';
import styles from '../../admin.module.css';

/* Mascotte du header.

   Une image affichée à côté du logo pendant une période donnée — Halloween,
   Noël, anniversaire de la boutique. Hors période, le header reste comme
   avant. Les images se collent par leur adresse (https), comme les photos des
   produits : il n'y a pas encore d'espace de stockage de fichiers. */

export const metadata = {title: 'Mascotte'};

export default async function Mascotte() {
	await exigerDroit('reglages.gerer');

	const mascottes = await listerMascottes();

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<h1 className={styles.titre}>Mascotte</h1>
					<p className={styles.sousTitre}>
						L’image du header change toute seule aux dates choisies.
					</p>
				</div>
			</div>

			<div className={styles.contenu}>
				<MascotteGestion mascottes={mascottes} />
			</div>
		</>
	);
}
