import Link from 'next/link';
import {Boxes, Euro, Mail, PackageCheck, Truck} from 'lucide-react';
import {aLeDroit, exigerStaff} from '@/server/auth/roles';
import {getChiffresTableauDeBord, getDernieresCommandes} from '@/server/services/dashboard';
import {LIBELLES_STATUT} from '@/server/services/orders';
import {formatDate, formatPrix, pluriel} from '@/lib/format';
import styles from '../admin.module.css';

/* Tableau de bord.

   Ce qu'on veut voir en ouvrant : ce qui attend une action, et ce que ça a
   rapporté. Pas de courbe sur six mois — la boutique n'a pas encore d'historique
   et un graphique à deux points ment plus qu'il n'informe. On l'ajoutera quand
   il y aura de quoi le remplir.

   Les montants ne s'affichent qu'à qui possède `finances.voir` : un préparateur
   voit les colis à faire partir, pas le chiffre d'affaires. */

export const metadata = {title: 'Tableau de bord'};

export default async function TableauDeBord() {
	const utilisateur = await exigerStaff();
	const finances = aLeDroit(utilisateur, 'finances.voir');

	const [chiffres, dernieres] = await Promise.all([
		getChiffresTableauDeBord({avecFinances: finances}),
		aLeDroit(utilisateur, 'commandes.voir') ? getDernieresCommandes() : [],
	]);

	const prenom = utilisateur.firstName ?? 'vous';

	const kpis = [
		finances && {
			cle: 'jour',
			Icone: Euro,
			label: "Encaissé aujourd'hui",
			valeur: formatPrix(chiffres.caJourCents),
			detail: pluriel(chiffres.commandesJour, 'commande', 'commandes'),
		},
		finances && {
			cle: 'semaine',
			Icone: Euro,
			label: 'Encaissé sur 7 jours',
			valeur: formatPrix(chiffres.caSemaineCents),
			detail: pluriel(chiffres.commandesSemaine, 'commande', 'commandes'),
		},
		{
			cle: 'preparer',
			Icone: PackageCheck,
			label: 'À préparer',
			valeur: String(chiffres.aPreparer),
			detail: 'Payées, pas encore commencées',
		},
		{
			cle: 'expedier',
			Icone: Truck,
			label: 'À expédier',
			valeur: String(chiffres.aExpedier),
			detail: 'Colis prêts à partir',
		},
		!finances && {
			cle: 'attente',
			Icone: Boxes,
			label: 'En attente de paiement',
			valeur: String(chiffres.enAttentePaiement),
			detail: 'Rien à préparer pour le moment',
		},
	].filter(Boolean);

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<h1 className={styles.titre}>Bonjour {prenom}</h1>
					<p className={styles.sousTitre}>
						{chiffres.aPreparer + chiffres.aExpedier > 0
							? `${chiffres.aPreparer + chiffres.aExpedier} commandes attendent une action.`
							: 'Rien n’attend, tout est à jour.'}
					</p>
				</div>
			</div>

			<div className={styles.contenu}>
				<div className={styles.grilleKpis}>
					{kpis.map(({cle, Icone, label, valeur, detail}) => (
						<div key={cle} className={styles.kpi}>
							<div className={styles.kpiEntete}>
								<span className={styles.kpiLabel}>{label}</span>
								<span className={styles.kpiIcone}>
									<Icone size={17} strokeWidth={2.75} />
								</span>
							</div>
							<div className={styles.kpiValeur}>{valeur}</div>
							<div className={styles.kpiDetail}>{detail}</div>
						</div>
					))}
				</div>

				<div className={styles.deuxColonnes}>
					<div className={styles.tableauCadre}>
						<div className={styles.filtres}>
							<h2 className={styles.carteTitre} style={{margin: 0}}>
								Dernières commandes
							</h2>
							<Link href='/admin/commandes' className={styles.compteur}>
								Tout voir →
							</Link>
						</div>

						{dernieres.length === 0 ? (
							<p className={styles.vide}>Aucune commande pour l’instant.</p>
						) : (
							<div className={styles.tableauDefile}>
								<table className={styles.tableau}>
									<thead>
										<tr>
											<th>Commande</th>
											<th>Client</th>
											<th>Montant</th>
											<th>Statut</th>
										</tr>
									</thead>
									<tbody>
										{dernieres.map((commande) => (
											<tr key={commande.orderNumber}>
												<td className={styles.cellulePrincipale}>
													<Link
														href={`/admin/commandes/${commande.orderNumber}`}
														className={styles.lienLigne}>
														{commande.orderNumber}
													</Link>
												</td>
												<td className={styles.celluleDiscrete}>
													{commande.email}
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

					<div className={styles.colonne}>
						<div className={styles.carte}>
							<h2 className={styles.carteTitre}>Stock à surveiller</h2>

							{chiffres.stockBas.length === 0 ? (
								<p className={styles.kpiDetail}>
									Aucune référence sous son seuil d’alerte.
								</p>
							) : (
								<div className={styles.listeStock}>
									{chiffres.stockBas.map((variante) => (
										<div key={variante.id} className={styles.ligneStock}>
											<span className={styles.pastilleStock} aria-hidden='true' />
											<span className={styles.nomStock}>
												{variante.product.name}
												{variante.name !== 'Standard' && ` — ${variante.name}`}
											</span>
											<span className={styles.quantiteStock}>
												{variante.stock}
											</span>
										</div>
									))}
								</div>
							)}
						</div>

						{finances && (
							<div className={styles.carte}>
								<h2 className={styles.carteTitre}>Newsletter</h2>
								<div className={styles.kpiEntete}>
									<span className={styles.kpiLabel}>Inscrits actifs</span>
									<span className={styles.kpiIcone}>
										<Mail size={17} strokeWidth={2.75} />
									</span>
								</div>
								<div className={styles.kpiValeur}>{chiffres.abonnes}</div>
								<div className={styles.kpiDetail}>
									Mis à jour le {formatDate(new Date())}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
