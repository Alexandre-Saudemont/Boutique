import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft} from 'lucide-react';
import {aLeDroit, exigerDroit} from '@/server/auth/roles';
import {LIBELLES_ROLE, getClient} from '@/server/services/customers';
import {LIBELLES_STATUT} from '@/server/services/orders';
import {formatDate, formatPrix, pluriel} from '@/lib/format';
import RoleForm from '../RoleForm';
import styles from '../../../admin.module.css';

/* Fiche d'un compte.

   Ce qu'il faut pour répondre au téléphone : qui c'est, comment le joindre, ce
   qu'il a commandé et où ça en est. Les détails d'une commande restent sur la
   fiche commande — un seul endroit où les lire, un seul droit qui la protège.

   Le bloc « rôle » n'apparaît qu'à l'administrateur. Le service client voit la
   fiche, pas les leviers d'accès. */

export const metadata = {title: 'Compte', robots: {index: false}};

export default async function FicheClient({params}) {
	const utilisateur = await exigerDroit('clients.voir');
	const {id} = await params;

	const client = await getClient(id);
	if (!client) notFound();

	const nom = [client.firstName, client.lastName].filter(Boolean).join(' ');

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<Link href='/admin/clients' className={styles.retour}>
						<ArrowLeft size={16} strokeWidth={2.75} />
						Tous les comptes
					</Link>
					<h1 className={styles.titre}>{nom || client.email}</h1>
					<p className={styles.sousTitre}>
						{LIBELLES_ROLE[client.role]} · inscrit le {formatDate(client.createdAt)}
						{client.anonymizedAt && ' · compte supprimé par le client'}
					</p>
				</div>
			</div>

			<div className={styles.contenu}>
				<div className={styles.detail}>
					<div className={styles.colonne}>
						<div className={styles.carte}>
							<h2 className={styles.carteTitre}>
								{client.orders.length}{' '}
								{pluriel(client.orders.length, 'commande', 'commandes')}
							</h2>

							{client.orders.length === 0 ? (
								<p className={styles.kpiDetail}>Aucune commande à ce jour.</p>
							) : (
								<div className={styles.tableauDefile}>
									<table className={styles.tableau}>
										<thead>
											<tr>
												<th>Réf.</th>
												<th>Date</th>
												<th>Montant</th>
												<th>Statut</th>
											</tr>
										</thead>
										<tbody>
											{client.orders.map((commande) => (
												<tr key={commande.orderNumber}>
													<td className={styles.cellulePrincipale}>
														{aLeDroit(utilisateur, 'commandes.voir') ? (
															<Link
																href={`/admin/commandes/${commande.orderNumber}`}
																className={styles.lienLigne}>
																{commande.orderNumber}
															</Link>
														) : (
															commande.orderNumber
														)}
													</td>
													<td className={styles.celluleDiscrete}>
														{formatDate(commande.createdAt)}
													</td>
													<td className={styles.celluleMontant}>
														{formatPrix(commande.totalCents)}
													</td>
													<td className={styles.celluleDiscrete}>
														{LIBELLES_STATUT[commande.status]}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					</div>

					<div className={styles.colonne}>
						<div className={styles.carte}>
							<h2 className={styles.carteTitre}>Contact</h2>

							<div className={styles.ligneResume}>
								<span>E-mail</span>
								<span>{client.email}</span>
							</div>
							<div className={styles.ligneResume}>
								<span>Adresse vérifiée</span>
								<span>
									{client.emailVerifiedAt ? formatDate(client.emailVerifiedAt) : 'Non'}
								</span>
							</div>
							{client.phone && (
								<div className={styles.ligneResume}>
									<span>Téléphone</span>
									<span>{client.phone}</span>
								</div>
							)}
							<div className={styles.ligneResume}>
								<span>Lettre d’information</span>
								<span>{client.marketingOptIn ? 'Consentement donné' : 'Non'}</span>
							</div>
							<div className={styles.ligneResume}>
								<span>Dernière connexion</span>
								<span>
									{client.lastLoginAt ? formatDate(client.lastLoginAt) : 'Jamais'}
								</span>
							</div>
							<div className={styles.ligneResume}>
								<span>Sessions ouvertes</span>
								<span>{client._count.sessions}</span>
							</div>
						</div>

						{aLeDroit(utilisateur, 'personnel.gerer') && !client.anonymizedAt && (
							<div className={styles.carte}>
								<h2 className={styles.carteTitre}>Accès au back-office</h2>
								<RoleForm client={client} estMoi={client.id === utilisateur.id} />
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
