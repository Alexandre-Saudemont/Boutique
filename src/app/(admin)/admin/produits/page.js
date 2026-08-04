import Link from 'next/link';
import {Plus} from 'lucide-react';
import {aLeDroit, exigerDroit} from '@/server/auth/roles';
import {listerProduitsAdmin} from '@/server/services/products';
import {formatPrix, pluriel} from '@/lib/format';
import styles from '../../admin.module.css';

/* Inventaire.

   Ce qui est en ligne, ce qui dort en brouillon, ce qui va manquer. Chaque nom
   ouvre la fiche d'édition — pour qui a le droit d'y toucher ; le préparateur,
   lui, consulte l'inventaire sans pouvoir modifier les prix. */

export const metadata = {title: 'Produits'};

export default async function Produits({searchParams}) {
	const utilisateur = await exigerDroit('produits.voir');
	const peutGerer = aLeDroit(utilisateur, 'produits.gerer');

	const parametres = await searchParams;
	const inclureArchives = parametres?.archives === '1';

	const produits = await listerProduitsAdmin({inclureArchives});

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<h1 className={styles.titre}>Produits</h1>
					<p className={styles.sousTitre}>
						{pluriel(produits.length, 'référence', 'références')}
						{inclureArchives ? ', archives comprises' : ''}
					</p>
				</div>

				{peutGerer && (
					<div className={styles.actionsTitre}>
						<Link href='/admin/produits/nouveau' className='btn btn-primary' style={{gap: 8}}>
							<Plus size={17} strokeWidth={2.75} />
							Ajouter un produit
						</Link>
					</div>
				)}
			</div>

			<div className={styles.contenu}>
				<div className={styles.tableauCadre}>
					<div className={styles.filtres}>
						<Link
							href='/admin/produits'
							className={`${styles.puce} ${!inclureArchives ? styles.puceActive : ''}`}>
							En catalogue
						</Link>
						<Link
							href='/admin/produits?archives=1'
							className={`${styles.puce} ${inclureArchives ? styles.puceActive : ''}`}>
							Avec les archives
						</Link>
					</div>

					{produits.length === 0 ? (
						<p className={styles.vide}>
							Aucun produit pour l’instant. Le catalogue se remplit depuis la base en
							attendant l’écran de saisie.
						</p>
					) : (
						<div className={styles.tableauDefile}>
							<table className={styles.tableau}>
								<thead>
									<tr>
										<th>Produit</th>
										<th>Rayon</th>
										<th>Prix</th>
										<th>Stock</th>
										<th>État</th>
										<th>Publication</th>
									</tr>
								</thead>
								<tbody>
									{produits.map((produit) => (
										<tr key={produit.id}>
											<td className={styles.cellulePrincipale}>
												{/* Vers l'édition pour qui peut modifier, vers la
												    fiche publique pour les autres — un lien qui
												    mène à une page interdite n'apprend rien. */}
												<Link
													href={
														peutGerer
															? `/admin/produits/${produit.id}`
															: `/produit/${produit.slug}`
													}
													className={styles.lienLigne}>
													{produit.nom}
												</Link>
												{produit.nbVariantes > 1 && (
													<span className={styles.celluleDiscrete}>
														{' '}
														· {produit.nbVariantes} variantes
													</span>
												)}
											</td>
											<td className={styles.celluleDiscrete}>
												{produit.rayon ?? '—'}
											</td>
											<td className={styles.celluleMontant}>
												{produit.prixMinCents === null
													? '—'
													: produit.prixMinCents === produit.prixMaxCents
														? formatPrix(produit.prixMinCents)
														: `dès ${formatPrix(produit.prixMinCents)}`}
											</td>
											<td
												style={{
													fontWeight: 600,
													color:
														produit.stock === 0
															? 'var(--color-accent-700)'
															: undefined,
												}}>
												{produit.stock}
											</td>
											<td className={styles.celluleDiscrete}>
												{produit.etat.libelle}
											</td>
											<td className={styles.celluleDiscrete}>
												{produit.publication}
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
