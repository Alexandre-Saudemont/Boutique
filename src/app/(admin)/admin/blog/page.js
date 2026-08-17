import Link from 'next/link';
import {Plus} from 'lucide-react';
import {exigerDroit} from '@/server/auth/roles';
import {listerArticlesAdmin} from '@/server/services/posts';
import {formatDate, pluriel} from '@/lib/format';
import styles from '../../admin.module.css';

/* Le blog, côté coulisses.

   Brouillons et articles publiés dans la même liste, les plus récemment
   modifiés en premier : c'est le texte en cours qu'on vient rouvrir, pas celui
   publié il y a six mois. */

export const metadata = {title: 'Blog'};

export default async function Blog() {
	await exigerDroit('reglages.gerer');

	const articles = await listerArticlesAdmin();
	const publies = articles.filter((article) => article.status === 'PUBLISHED').length;

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<h1 className={styles.titre}>Blog</h1>
					<p className={styles.sousTitre}>
						{pluriel(publies, 'article publié', 'articles publiés')} ·{' '}
						{articles.length - publies} en brouillon
					</p>
				</div>

				<div className={styles.actionsTitre}>
					<Link href='/admin/blog/nouveau' className='btn btn-primary' style={{gap: 8}}>
						<Plus size={17} strokeWidth={2.75} />
						Écrire un article
					</Link>
				</div>
			</div>

			<div className={styles.contenu}>
				<div className={styles.tableauCadre}>
					{articles.length === 0 ? (
						<p className={styles.vide}>Aucun article pour l’instant.</p>
					) : (
						<div className={styles.tableauDefile}>
							<table className={styles.tableau}>
								<thead>
									<tr>
										<th>Article</th>
										<th>Catégorie</th>
										<th>Statut</th>
										<th>Modifié le</th>
									</tr>
								</thead>
								<tbody>
									{articles.map((article) => (
										<tr key={article.id}>
											<td className={styles.cellulePrincipale}>
												<Link
													href={`/admin/blog/${article.id}`}
													className={styles.lienLigne}>
													{article.title}
												</Link>
											</td>
											<td className={styles.celluleDiscrete}>
												{article.categories[0]?.name ?? '—'}
											</td>
											<td className={styles.celluleDiscrete}>
												{article.status === 'PUBLISHED'
													? `Publié le ${formatDate(article.publishedAt)}`
													: 'Brouillon'}
											</td>
											<td className={styles.celluleDiscrete}>
												{formatDate(article.updatedAt)}
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
