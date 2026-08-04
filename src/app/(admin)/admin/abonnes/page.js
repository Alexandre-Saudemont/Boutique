import Link from 'next/link';
import {Download} from 'lucide-react';
import {exigerDroit} from '@/server/auth/roles';
import {listerAbonnes} from '@/server/services/newsletter';
import {formatDate, pluriel} from '@/lib/format';
import UnsubscribeButton from './UnsubscribeButton';
import styles from '../../admin.module.css';

/* Abonnés à la lettre de l'antre.

   Les désinscrits restent affichables : le RGPD demande de pouvoir prouver le
   consentement comme le retrait. Les effacer effacerait aussi cette preuve — et
   rien n'empêcherait de les réimporter par erreur au prochain envoi. */

export const metadata = {title: 'Abonnés'};

export default async function Abonnes({searchParams}) {
	await exigerDroit('abonnes.voir');

	const parametres = await searchParams;
	const inclureDesinscrits = parametres?.tous === '1';

	const abonnes = await listerAbonnes({inclureDesinscrits});

	// Seuls les confirmés comptent : c'est le nombre de personnes que la lettre
	// atteindra réellement.
	const confirmes = abonnes.filter(
		(abonne) => abonne.confirmedAt && !abonne.unsubscribedAt,
	).length;
	const enAttente = abonnes.filter(
		(abonne) => !abonne.confirmedAt && !abonne.unsubscribedAt,
	).length;

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<h1 className={styles.titre}>Abonnés</h1>
					<p className={styles.sousTitre}>
						{pluriel(confirmes, 'inscrit confirmé', 'inscrits confirmés')}
						{enAttente > 0 && ` · ${enAttente} en attente de confirmation`}
					</p>
				</div>

				<div className={styles.actionsTitre}>
					<a href='/admin/abonnes/export' className='btn btn-secondary' style={{gap: 8}}>
						<Download size={16} strokeWidth={2.75} />
						Exporter en CSV
					</a>
				</div>
			</div>

			<div className={styles.contenu}>
				<div className={styles.tableauCadre}>
					<div className={styles.filtres}>
						<Link
							href='/admin/abonnes'
							className={`${styles.puce} ${!inclureDesinscrits ? styles.puceActive : ''}`}>
							Inscrits
						</Link>
						<Link
							href='/admin/abonnes?tous=1'
							className={`${styles.puce} ${inclureDesinscrits ? styles.puceActive : ''}`}>
							Avec les désinscrits
						</Link>
					</div>

					{abonnes.length === 0 ? (
						<p className={styles.vide}>Personne pour l’instant.</p>
					) : (
						<div className={styles.tableauDefile}>
							<table className={styles.tableau}>
								<thead>
									<tr>
										<th>E-mail</th>
										<th>Inscrit le</th>
										<th>Source</th>
										<th>Statut</th>
										<th className={styles.celluleActions}>Retirer</th>
									</tr>
								</thead>
								<tbody>
									{abonnes.map((abonne) => (
										<tr key={abonne.id}>
											<td className={styles.cellulePrincipale}>{abonne.email}</td>
											<td className={styles.celluleDiscrete}>
												{formatDate(abonne.consentAt)}
											</td>
											<td className={styles.celluleDiscrete}>
												{abonne.source ?? '—'}
											</td>
											<td className={styles.celluleDiscrete}>
												{/* Trois états, pas deux : une adresse inscrite mais
												    non confirmée ne recevra aucune lettre, et il
												    faut le voir d'un coup d'œil. */}
												{abonne.unsubscribedAt
													? `Désinscrit le ${formatDate(abonne.unsubscribedAt)}`
													: abonne.confirmedAt
														? 'Confirmé'
														: 'En attente de confirmation'}
											</td>
											<td className={styles.celluleActions}>
												{!abonne.unsubscribedAt && (
													<UnsubscribeButton id={abonne.id} />
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>
		</>
	);
}
