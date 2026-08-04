import Link from 'next/link';
import {exigerDroit} from '@/server/auth/roles';
import {LIBELLES_STATUT, listerCommandes} from '@/server/services/orders';
import {formatDate, formatPrix, pluriel} from '@/lib/format';
import styles from '../../admin.module.css';

/* Liste des commandes.

   Les filtres passent par l'URL et non par un état de composant : une vue
   filtrée se met en favori, se partage et se recharge à l'identique. C'est
   aussi ce qui permet de rester en Server Component — pas de JavaScript à
   charger pour afficher un tableau.

   Recherche volontairement simple : numéro de commande ou e-mail. C'est ce
   qu'on a sous les yeux quand un client écrit ou appelle. */

export const metadata = {title: 'Commandes'};

const FILTRES = [
	{cle: null, libelle: 'Toutes'},
	{cle: 'PAID', libelle: 'À préparer'},
	{cle: 'PREPARING', libelle: 'En préparation'},
	{cle: 'SHIPPED', libelle: 'Expédiées'},
	{cle: 'PENDING_PAYMENT', libelle: 'En attente de paiement'},
	{cle: 'CANCELLED', libelle: 'Annulées'},
];

export default async function Commandes({searchParams}) {
	await exigerDroit('commandes.voir');

	const parametres = await searchParams;
	const statut = FILTRES.some((f) => f.cle === parametres?.statut) ? parametres.statut : null;
	const recherche = parametres?.q ?? null;

	const {commandes, total} = await listerCommandes({statut, recherche});

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<h1 className={styles.titre}>Commandes</h1>
					<p className={styles.sousTitre}>
						{pluriel(total, 'commande', 'commandes')}
						{statut ? ` · ${LIBELLES_STATUT[statut].toLowerCase()}` : ''}
					</p>
				</div>

				{/* Formulaire en GET : la recherche atterrit dans l'URL, donc dans
				    l'historique du navigateur et dans les favoris. */}
				<form className={styles.actionsTitre} method='get'>
					{statut && <input type='hidden' name='statut' value={statut} />}
					<input
						className='input'
						type='search'
						name='q'
						defaultValue={recherche ?? ''}
						placeholder='Numéro ou e-mail…'
						aria-label='Rechercher une commande'
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
						{FILTRES.map((filtre) => {
							const actif = filtre.cle === statut;
							const parametresLien = new URLSearchParams();
							if (filtre.cle) parametresLien.set('statut', filtre.cle);
							if (recherche) parametresLien.set('q', recherche);
							const suffixe = parametresLien.toString();

							return (
								<Link
									key={filtre.libelle}
									href={`/admin/commandes${suffixe ? `?${suffixe}` : ''}`}
									className={`${styles.puce} ${actif ? styles.puceActive : ''}`}>
									{filtre.libelle}
								</Link>
							);
						})}
					</div>

					{commandes.length === 0 ? (
						<p className={styles.vide}>
							{recherche
								? `Aucune commande ne correspond à « ${recherche} ».`
								: 'Aucune commande dans cette vue.'}
						</p>
					) : (
						<div className={styles.tableauDefile}>
							<table className={styles.tableau}>
								<thead>
									<tr>
										<th>Réf.</th>
										<th>Date</th>
										<th>Client</th>
										<th>Articles</th>
										<th>Montant</th>
										<th>Statut</th>
									</tr>
								</thead>
								<tbody>
									{commandes.map((commande) => {
										const destinataire = commande.addresses[0];

										return (
											<tr key={commande.orderNumber}>
												<td className={styles.cellulePrincipale}>
													<Link
														href={`/admin/commandes/${commande.orderNumber}`}
														className={styles.lienLigne}>
														{commande.orderNumber}
													</Link>
												</td>
												<td className={styles.celluleDiscrete}>
													{formatDate(commande.createdAt)}
												</td>
												<td>
													{destinataire
														? `${destinataire.firstName} ${destinataire.lastName}`
														: commande.email}
												</td>
												<td className={styles.celluleDiscrete}>
													{commande._count.items}
												</td>
												<td className={styles.celluleMontant}>
													{formatPrix(commande.totalCents)}
												</td>
												<td className={styles.celluleDiscrete}>
													{LIBELLES_STATUT[commande.status]}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>
		</>
	);
}
