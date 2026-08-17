import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft} from 'lucide-react';
import {exigerDroit} from '@/server/auth/roles';
import {getArticlePourEdition} from '@/server/services/posts';
import {formatDate} from '@/lib/format';
import PostForm from '../PostForm';
import styles from '../../../admin.module.css';

export async function generateMetadata({params}) {
	const {id} = await params;
	const article = await getArticlePourEdition(id);

	return {title: article ? article.title : 'Article'};
}

export default async function ModifierArticle({params, searchParams}) {
	await exigerDroit('reglages.gerer');

	const [{id}, parametres] = await Promise.all([params, searchParams]);
	const article = await getArticlePourEdition(id);

	if (!article) notFound();

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<Link href='/admin/blog' className={styles.retour}>
						<ArrowLeft size={16} strokeWidth={2.75} />
						Tous les articles
					</Link>
					<h1 className={styles.titre}>{article.title}</h1>
					<p className={styles.sousTitre}>
						{article.status === 'PUBLISHED'
							? `Publié le ${formatDate(article.publishedAt)}`
							: 'Brouillon'}{' '}
						· modifié le {formatDate(article.updatedAt)}
					</p>
				</div>
			</div>

			<div className={styles.contenu}>
				{parametres?.enregistre === '1' && <p className={styles.succes}>Article enregistré.</p>}

				<PostForm article={article} />
			</div>
		</>
	);
}
