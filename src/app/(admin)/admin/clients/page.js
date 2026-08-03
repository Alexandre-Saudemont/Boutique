import Link from 'next/link';
import {exigerDroit} from '@/server/auth/roles';
import {LIBELLES_ROLE, listerClients} from '@/server/services/customers';
import {formatDate, pluriel} from '@/lib/format';
import styles from '../../admin.module.css';

/* Les comptes.

   Deux vues d'une même liste : tout le monde, ou l'équipe seulement. La seconde
   est celle qu'on ouvre pour vérifier qui a des accès — une question qu'on se
   pose rarement, mais à laquelle il faut pouvoir répondre en trois secondes.

   Aucune donnée de commande ici : la liste sert à retrouver quelqu'un, pas à
   consulter son historique. Ça se fait sur sa fiche. */

export const metadata = {title: 'Comptes'};

export default async function Clients({searchParams}) {
	await exigerDroit('clients.voir');

	const parametres = await searchParams;
	const staffSeulement = parametres?.equipe === '1';
	const recherche = parametres?.q ?? null;

	const comptes = await listerClients({recherche, staffSeulement});

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<h1 className={styles.titre}>{staffSeulement ? 'L’équipe' : 'Comptes'}</h1>
					<p className={styles.sousTitre}>
						{comptes.length} {pluriel(comptes.length, 'compte', 'comptes')}
					</p>
				</div>

				<form className={styles.actionsTitre} method='get'>
					{staffSeulement && <input type='hidden' name='equipe' value='1' />}
					<input
						className='input'
						type='search'
						name='q'
						defaultValue={recherche ?? ''}
						placeholder='Nom ou e-mail…'
						aria-label='Rechercher un compte'
						style={{width: 220, fontSize: 13.5}}
					/>
					<button type='submit' className='btn btn-secondary'>
						Rechercher
					</button>
				</form>
			</div>

			<div className={styles.contenu}>
				<div className={styles.tableauCadre}>
					<div className={styles.filtres}>
						<Link
							href='/admin/clients'
							className={`${styles.puce} ${!staffSeulement ? styles.puceActive : ''}`}>
							Tous les comptes
						</Link>
						<Link
							href='/admin/clients?equipe=1'
							className={`${styles.puce} ${staffSeulement ? styles.puceActive : ''}`}>
							L’équipe
						</Link>
					</div>

					{comptes.length === 0 ? (
						<p className={styles.vide}>
							{recherche ? `Aucun compte ne correspond à « ${recherche} ».` : 'Aucun compte.'}
						</p>
					) : (
						<div className={styles.tableauDefile}>
							<table className={styles.tableau}>
								<thead>
									<tr>
										<th>Compte</th>
										<th>Rôle</th>
										<th>Commandes</th>
										<th>Adresse vérifiée</th>
										<th>Inscrit le</th>
									</tr>
								</thead>
								<tbody>
									{comptes.map((compte) => (
										<tr key={compte.id}>
											<td className={styles.cellulePrincipale}>
												<Link
													href={`/admin/clients/${compte.id}`}
													className={styles.lienLigne}>
													{compte.nom ?? compte.email}
												</Link>
												{compte.nom && (
													<span className={styles.celluleDiscrete}>
														{' '}
														· {compte.email}
													</span>
												)}
											</td>
											<td className={styles.celluleDiscrete}>
												{LIBELLES_ROLE[compte.role]}
											</td>
											<td className={styles.celluleDiscrete}>{compte.commandes}</td>
											<td className={styles.celluleDiscrete}>
												{compte.verifie ? 'Oui' : 'Non'}
											</td>
											<td className={styles.celluleDiscrete}>
												{formatDate(compte.inscritLe)}
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
