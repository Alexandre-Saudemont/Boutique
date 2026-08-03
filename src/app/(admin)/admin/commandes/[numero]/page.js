import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft} from 'lucide-react';
import {aLeDroit, exigerDroit} from '@/server/auth/roles';
import {LIBELLES_STATUT, getCommandeAdmin, statutsSuivants} from '@/server/services/orders';
import {historique} from '@/server/services/audit';
import {formatDate, formatPrix} from '@/lib/format';
import OrderActions from './OrderActions';
import styles from '../../../admin.module.css';

/* Fiche d'une commande : le bon de préparation.

   Tout ce qu'il faut pour emballer et expédier tient sur cet écran — les
   articles avec leur SKU, l'adresse, le mode d'envoi — sans avoir à naviguer.
   Les montants sont ceux figés à la commande, jamais recalculés : c'est la
   facture, pas une estimation. */

export async function generateMetadata({params}) {
	const {numero} = await params;
	return {title: `Commande ${numero}`};
}

/// Les actions du journal, dites en français. Une clé absente s'affiche telle
/// quelle plutôt que de disparaître : mieux vaut un intitulé technique qu'une
/// ligne vide dans un historique.
const LIBELLES_JOURNAL = {
	'order.status_changed': 'Statut modifié',
	'order.note_updated': 'Note interne mise à jour',
};

const LIBELLES_PAIEMENT = {
	PENDING: 'En attente',
	SUCCEEDED: 'Réussi',
	FAILED: 'Échoué',
	REFUNDED: 'Remboursé',
};

export default async function FicheCommande({params}) {
	const utilisateur = await exigerDroit('commandes.voir');
	const {numero} = await params;

	const commande = await getCommandeAdmin(numero);
	if (!commande) notFound();

	// L'historique est indexé par le numéro de commande, pas par l'identifiant
	// interne : c'est ce que les gens lisent et ce qu'on retrouve dans un
	// journal comme dans un e-mail.
	const journal = await historique('order', numero);

	const livraison = commande.addresses.find((adresse) => adresse.type === 'SHIPPING');
	const paiement = commande.payments[0];
	const peutGerer = aLeDroit(utilisateur, 'commandes.gerer');

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<Link href='/admin/commandes' className={styles.retour}>
						<ArrowLeft size={16} strokeWidth={2.75} />
						Toutes les commandes
					</Link>
					<h1 className={styles.titre}>{commande.orderNumber}</h1>
					<p className={styles.sousTitre}>
						{LIBELLES_STATUT[commande.status]} · passée le {formatDate(commande.createdAt)}
						{commande.paidAt && ` · payée le ${formatDate(commande.paidAt)}`}
					</p>
				</div>
			</div>

			<div className={styles.contenu}>
				<div className={styles.detail}>
					<div className={styles.colonne}>
						<div className={styles.carte}>
							<h2 className={styles.carteTitre}>Articles</h2>

							<div className={styles.tableauDefile}>
								<table className={styles.tableau}>
									<thead>
										<tr>
											<th>Article</th>
											<th>SKU</th>
											<th>Qté</th>
											<th>Total</th>
										</tr>
									</thead>
									<tbody>
										{commande.items.map((ligne) => (
											<tr key={ligne.id}>
												<td className={styles.cellulePrincipale}>
													{ligne.productName}
													{ligne.variantName !== 'Standard' && (
														<span className={styles.celluleDiscrete}>
															{' '}
															— {ligne.variantName}
														</span>
													)}
												</td>
												<td className={styles.celluleDiscrete}>{ligne.sku}</td>
												<td>{ligne.quantity}</td>
												<td className={styles.celluleMontant}>
													{formatPrix(ligne.totalCents)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							<div style={{marginTop: 18}}>
								<div className={styles.ligneResume}>
									<span>Articles</span>
									<span>{formatPrix(commande.subtotalCents)}</span>
								</div>
								{commande.discountCents > 0 && (
									<div className={styles.ligneResume}>
										<span>
											Réduction
											{commande.discountCode ? ` (${commande.discountCode})` : ''}
										</span>
										<span>−{formatPrix(commande.discountCents)}</span>
									</div>
								)}

								<div className={styles.ligneResume}>
									<span>{commande.shippingMethod ?? 'Livraison'}</span>
									<span>
										{commande.shippingCents === 0
											? 'Offerte'
											: formatPrix(commande.shippingCents)}
									</span>
								</div>
								{/* En franchise de TVA, la ligne n'existe pas : afficher
								    « TVA 0 € » ferait croire à une TVA à taux zéro, qui
								    n'est pas la même chose. */}
								{commande.vatRegime === 'STANDARD' && (
									<div className={styles.ligneResume}>
										<span>TVA</span>
										<span>{formatPrix(commande.vatCents)}</span>
									</div>
								)}
								<div className={`${styles.ligneResume} ${styles.ligneTotal}`}>
									<span>Total</span>
									<span>{formatPrix(commande.totalCents)}</span>
								</div>
							</div>
						</div>

						<div className={styles.carte}>
							<h2 className={styles.carteTitre}>Livraison</h2>

							{livraison ? (
								<address className={styles.adresse}>
									{livraison.firstName} {livraison.lastName}
									<br />
									{livraison.line1}
									{livraison.line2 && (
										<>
											<br />
											{livraison.line2}
										</>
									)}
									<br />
									{livraison.postalCode} {livraison.city}
									<br />
									{livraison.country}
								</address>
							) : (
								<p className={styles.kpiDetail}>Aucune adresse enregistrée.</p>
							)}

							<div className={styles.ligneResume}>
								<span>Mode</span>
								<span>
									{[commande.carrier, commande.shippingMethod]
										.filter(Boolean)
										.join(' · ') || '—'}
								</span>
							</div>
							{commande.trackingNumber && (
								<div className={styles.ligneResume}>
									<span>Suivi</span>
									<span>{commande.trackingNumber}</span>
								</div>
							)}
							{commande.customerNote && (
								<p className={styles.kpiDetail}>
									Mot du client : « {commande.customerNote} »
								</p>
							)}
						</div>
					</div>

					<div className={styles.colonne}>
						<div className={styles.carte}>
							<h2 className={styles.carteTitre}>Client</h2>
							<div className={styles.ligneResume}>
								<span>E-mail</span>
								<span>{commande.email}</span>
							</div>
							{commande.phone && (
								<div className={styles.ligneResume}>
									<span>Téléphone</span>
									<span>{commande.phone}</span>
								</div>
							)}
							<div className={styles.ligneResume}>
								<span>Compte</span>
								<span>{commande.user ? 'Client inscrit' : 'Commande invité'}</span>
							</div>
						</div>

						<div className={styles.carte}>
							<h2 className={styles.carteTitre}>Paiement</h2>
							{paiement ? (
								<>
									<div className={styles.ligneResume}>
										<span>{paiement.provider === 'PAYPAL' ? 'PayPal' : 'Stripe'}</span>
										<span>{LIBELLES_PAIEMENT[paiement.status]}</span>
									</div>
									<div className={styles.ligneResume}>
										<span>Montant</span>
										<span>{formatPrix(paiement.amountCents)}</span>
									</div>
									{paiement.refundedCents > 0 && (
										<div className={styles.ligneResume}>
											<span>Remboursé</span>
											<span>{formatPrix(paiement.refundedCents)}</span>
										</div>
									)}
									{/* L'identifiant Stripe sert à retrouver la transaction
									    dans leur tableau de bord — pour un remboursement ou
									    une contestation. */}
									{paiement.providerPaymentId && (
										<p className={styles.kpiDetail}>{paiement.providerPaymentId}</p>
									)}
								</>
							) : (
								<p className={styles.kpiDetail}>Aucun paiement rattaché.</p>
							)}
						</div>

						{journal.length > 0 && (
							<div className={styles.carte}>
								<h2 className={styles.carteTitre}>Historique</h2>

								<div className={styles.listeStock}>
									{journal.map((entree) => (
										<div key={entree.id} className={styles.ligneResume}>
											<span>
												{LIBELLES_JOURNAL[entree.action] ?? entree.action}
												{entree.metadata?.statut &&
													` — ${LIBELLES_STATUT[entree.metadata.statut] ?? entree.metadata.statut}`}
											</span>
											<span className={styles.celluleDiscrete}>
												{entree.user?.firstName ?? entree.user?.email ?? 'système'}
												{' · '}
												{formatDate(entree.createdAt)}
											</span>
										</div>
									))}
								</div>
							</div>
						)}

						{peutGerer ? (
							<OrderActions
								numero={commande.orderNumber}
								suivants={statutsSuivants(commande.status)}
								transporteur={commande.carrier}
								suivi={commande.trackingNumber}
								note={commande.adminNote}
							/>
						) : (
							commande.adminNote && (
								<div className={styles.carte}>
									<h2 className={styles.carteTitre}>Note interne</h2>
									<p className={styles.adresse}>{commande.adminNote}</p>
								</div>
							)
						)}
					</div>
				</div>
			</div>
		</>
	);
}
