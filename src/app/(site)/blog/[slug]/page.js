import Link from 'next/link';
import Image from 'next/image';
import {notFound} from 'next/navigation';
import {ArrowLeft, Mail} from 'lucide-react';
import {getArticleParSlug, getArticlesLies} from '@/server/services/posts';
import {formatDate} from '@/lib/format';
import {adresseDuSite} from '@/lib/site-url';
import styles from '../blog.module.css';

/* La lecture d'un article.

   Le contenu est du texte brut, saisi dans un simple champ côté back-office —
   décision prise avec l'éditeur (voir `PostForm.js`). Il est découpé en
   paragraphes ici et rendu par React, donc échappé : du HTML collé depuis un
   autre site s'affiche tel quel au lieu de s'exécuter chez les visiteurs. C'est
   ce qui permet de se passer d'une bibliothèque de nettoyage. */

export async function generateMetadata({params}) {
	const {slug} = await params;
	const article = await getArticleParSlug(slug);

	if (!article) return {title: 'Article introuvable'};

	return {
		title: article.metaTitre ?? article.titre,
		description: article.metaDescription ?? article.chapeau ?? undefined,
		openGraph: {
			title: article.titre,
			description: article.chapeau ?? undefined,
			images: article.image ? [article.image] : undefined,
			type: 'article',
		},
	};
}

/* Découpe le texte en paragraphes sur les lignes vides.

   Une simple coupure à chaque retour à la ligne ferait un paragraphe par ligne
   d'un texte tapé au fil de l'eau. La ligne vide, elle, est le geste que fait
   tout le monde pour séparer deux idées. */
function paragraphes(contenu) {
	return String(contenu ?? '')
		.split(/\n\s*\n/)
		.map((bloc) => bloc.trim())
		.filter(Boolean);
}

export default async function Article({params}) {
	const {slug} = await params;
	const article = await getArticleParSlug(slug);

	if (!article) notFound();

	const lies = await getArticlesLies(article.id, article.categorieSlug);
	const blocs = paragraphes(article.contenu);

	return (
		<article className={styles.article}>
			<Link href='/blog' className={styles.retour}>
				<ArrowLeft size={16} strokeWidth={2.75} />
				Tous les articles
			</Link>

			{article.categorie && (
				<div>
					<span className='tag tag-accent' style={{marginBottom: 18}}>
						{article.categorie}
					</span>
				</div>
			)}

			<h1 className={styles.articleTitre}>{article.titre}</h1>

			<div className={styles.signature}>
				<span className={styles.avatar} aria-hidden='true'>
					{article.auteur.charAt(0)}
				</span>

				<div>
					<div className={styles.signatureNom}>{article.auteur}</div>
					{article.date && (
						<div className={styles.signatureMeta}>
							<time dateTime={new Date(article.date).toISOString()}>
								{formatDate(article.date)}
							</time>
						</div>
					)}
				</div>
			</div>

			{article.image && (
				<figure className={styles.couverture}>
					<Image
						src={article.image}
						alt=''
						fill
						sizes='(max-width: 820px) 100vw, 820px'
						priority
						className={`${styles.image} washed`}
					/>
				</figure>
			)}

			{article.chapeau && <p className={styles.lead}>{article.chapeau}</p>}

			<div className={styles.corps}>
				{blocs.map((bloc, rang) => (
					<p key={rang}>{bloc}</p>
				))}
			</div>

			<div className={styles.partage}>
				<span className={styles.partageLibelle}>Partager</span>

				{/* Un `mailto:` plutôt qu'un bouton « copier le lien » : il fonctionne
				    sans JavaScript et ne demande pas de rendre la page cliente pour
				    une seule interaction. */}
				<a
					href={`mailto:?subject=${encodeURIComponent(article.titre)}&body=${encodeURIComponent(
						`À lire sur l'antre du vieux geek fou : ${adresseDuSite()}/blog/${article.slug}`,
					)}`}
					className='btn btn-secondary'
					style={{padding: '9px 16px', fontSize: 13.5, gap: 8}}>
					<Mail size={16} strokeWidth={2.75} />
					Envoyer par mail
				</a>
			</div>

			{lies.length > 0 && (
				<div className={styles.ensuite}>
					<h2 className={styles.ensuiteTitre}>À lire ensuite</h2>

					<div className={styles.ensuiteListe}>
						{lies.map((lie) => (
							<Link key={lie.id} href={`/blog/${lie.slug}`} className={styles.ensuiteCarte}>
								<div className={styles.ensuiteVisuel}>
									{lie.image ? (
										<Image
											src={lie.image}
											alt=''
											fill
											sizes='84px'
											className={`${styles.image} washed`}
										/>
									) : (
										<span className={styles.initiale} aria-hidden='true'>
											{lie.titre.charAt(0)}
										</span>
									)}
								</div>

								<div style={{minWidth: 0}}>
									{lie.categorie && (
										<span className={styles.ensuiteKicker}>{lie.categorie}</span>
									)}
									<span className={styles.ensuiteNom}>{lie.titre}</span>
								</div>
							</Link>
						))}
					</div>
				</div>
			)}
		</article>
	);
}
