import Link from 'next/link';
import {exigerDroit} from '@/server/auth/roles';
import {listerProduitsAdmin} from '@/server/services/products';
import {formatPrix, pluriel} from '@/lib/format';
import styles from '../../admin.module.css';

/* Inventaire.

   Écran de lecture pour l'instant : voir ce qui est en ligne, ce qui dort en
   brouillon et ce qui va manquer. La saisie et la modification d'un produit
   viendront ensuite — c'est un formulaire à part entière (photos, variantes,
   options) qui mérite son propre chantier plutôt qu'un champ ajouté à la
   va-vite dans un tableau. */

export const metadata = {title: 'Produits'};

export default async function Produits({searchParams}) {
	await exigerDroit('produits.voir');

	const parametres = await searchParams;
	const inclureArchives = parametres?.archives === '1';

	const produits = await listerProduitsAdmin({inclureArchives});

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<h1 className={styles.titre}>Produits</h1>
					<p className={styles.sousTitre}>
						{produits.length} {pluriel(produits.length, 'référence', 'références')}
						{inclureArchives ? ', archives comprises' : ''}
					</p>
				</div>
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
												{/* Vers la fiche publique : c'est ce que voit le
												    client, et le seul écran de détail existant. */}
												<Link
													href={`/produit/${produit.slug}`}
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
