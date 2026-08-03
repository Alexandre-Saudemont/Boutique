import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import {exigerDroit} from '@/server/auth/roles';
import PostForm from '../PostForm';
import styles from '../../../admin.module.css';

export const metadata = {title: 'Nouvel article'};

export default async function NouvelArticle() {
	await exigerDroit('reglages.gerer');

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<Link href='/admin/blog' className={styles.retour}>
						<ArrowLeft size={16} strokeWidth={2.75} />
						Tous les articles
					</Link>
					<h1 className={styles.titre}>Nouvel article</h1>
					<p className={styles.sousTitre}>
						Enregistré en brouillon tant que vous ne le publiez pas.
					</p>
				</div>
			</div>

			<div className={styles.contenu}>
				<PostForm article={null} />
			</div>
		</>
	);
}
