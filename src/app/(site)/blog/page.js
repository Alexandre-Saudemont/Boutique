import Link from 'next/link';
import Image from 'next/image';
import {ArrowRight} from 'lucide-react';
import {listerArticles, listerCategoriesArticles} from '@/server/services/posts';
import {formatDate} from '@/lib/format';
import NewsletterForm from '@/components/NewsletterForm/NewsletterForm';
import styles from './blog.module.css';

/* La liste des articles.

   Le filtre par catégorie passe par l'URL, comme celui de la boutique :
   `/blog?categorie=atelier` se partage et se met en favori. La maquette
   basculait entre liste et lecture dans la même page ; ici l'article a sa
   propre adresse, sans quoi rien de ce qui est écrit ne serait partageable ni
   trouvable dans un moteur de recherche — pour un blog, ce serait absurde.

   L'article à la une n'apparaît que sur « Tous » : dans une catégorie filtrée,
   il ferait doublon avec la première carte de la grille. */

export const metadata = {
	title: 'Le blog de l’antre',
	description:
		'Chroniques, coups de cœur et ateliers d’un vieux geek qui aime autant raconter les objets que les vendre.',
};

export default async function Blog({searchParams}) {
	const parametres = await searchParams;
	const categorieActive = parametres.categorie ?? null;

	const [categories, articles] = await Promise.all([
		listerCategoriesArticles(),
		listerArticles({categorie: categorieActive}),
	]);

	const [une, ...reste] = articles;
	const montrerLaUne = !categorieActive && Boolean(une);
	const grille = montrerLaUne ? reste : articles;

	return (
		<>
			<section className={styles.intro}>
				<div className={styles.blob} aria-hidden='true' />

				<div className={styles.introContenu}>
					<span className={styles.kicker}>Le blog de l&apos;antre</span>

					<h1 className={styles.titre}>Des histoires de geek, servies chaudes</h1>

					<p className={styles.chapeau}>
						Chroniques, coups de cœur et ateliers d&apos;un vieux geek qui aime autant raconter les
						objets que les vendre. On prend le temps, on rentre dans les détails.
					</p>

					{categories.length > 0 && (
						<nav className={styles.categories} aria-label='Catégories'>
							<Link
								href='/blog'
								className={`${styles.categorie} ${
									categorieActive ? '' : styles.categorieActive
								}`}
								aria-current={categorieActive ? undefined : 'true'}>
								Tous
							</Link>

							{categories.map((categorie) => (
								<Link
									key={categorie.slug}
									href={`/blog?categorie=${encodeURIComponent(categorie.slug)}`}
									className={`${styles.categorie} ${
										categorieActive === categorie.slug ? styles.categorieActive : ''
									}`}
									aria-current={categorieActive === categorie.slug ? 'true' : undefined}>
									{categorie.name}
								</Link>
							))}
						</nav>
					)}
				</div>
			</section>

			{montrerLaUne && (
				<section className={styles.sectionUne}>
					<Link href={`/blog/${une.slug}`} className={styles.une}>
						<figure className={styles.uneVisuel}>
							{une.image ? (
								<Image
									src={une.image}
									alt=''
									fill
									sizes='(max-width: 900px) 100vw, 560px'
									className={`${styles.image} washed`}
								/>
							) : (
								<span className={styles.initiale} aria-hidden='true'>
									{une.titre.charAt(0)}
								</span>
							)}
						</figure>

						<div className={styles.uneCorps}>
							<span className='tag tag-accent' style={{marginBottom: 14}}>
								À la une{une.categorie ? ` · ${une.categorie}` : ''}
							</span>

							<h2 className={styles.uneTitre}>{une.titre}</h2>

							{une.chapeau && <p className={styles.uneChapeau}>{une.chapeau}</p>}

							<span className={styles.lire}>
								Lire l&apos;article
								<ArrowRight size={17} strokeWidth={2.75} />
							</span>

							{une.date && <div className={styles.meta}>{formatDate(une.date)}</div>}
						</div>
					</Link>
				</section>
			)}

			<section className={styles.sectionGrille}>
				{grille.length > 0 ? (
					<div className={styles.grille}>
						{grille.map((article) => (
							<Link key={article.id} href={`/blog/${article.slug}`} className={styles.carte}>
								<div className={styles.carteVisuel}>
									{article.image ? (
										<Image
											src={article.image}
											alt=''
											fill
											sizes='(max-width: 620px) 100vw, (max-width: 900px) 50vw, 360px'
											className={`${styles.image} washed`}
										/>
									) : (
										<span className={styles.initiale} aria-hidden='true'>
											{article.titre.charAt(0)}
										</span>
									)}
								</div>

								{article.categorie && (
									<span className={`tag tag-accent-2 ${styles.etiquette}`}>
										{article.categorie}
									</span>
								)}

								<h2 className={styles.carteTitre}>{article.titre}</h2>

								{article.chapeau && <p className={styles.carteChapeau}>{article.chapeau}</p>}

								{article.date && (
									<span className={styles.carteMeta}>{formatDate(article.date)}</span>
								)}
							</Link>
						))}
					</div>
				) : (
					<p className={styles.vide}>
						{categorieActive
							? 'Rien dans ce rayon pour l’instant — revenez vite.'
							: montrerLaUne
								? 'Un seul article pour l’instant — la suite arrive.'
								: 'Le premier article s’écrit encore. Revenez bientôt.'}
					</p>
				)}
			</section>

			<section className={styles.sectionLettre}>
				<div className={styles.lettre}>
					<div className={styles.lettreIntro}>
						<h2 className={styles.lettreTitre}>Un nouvel article, une fois de temps en temps</h2>
						<p className={styles.lettreTexte}>
							Pas de spam, pas de cadence forcée — juste la lettre de l&apos;antre quand il y a
							vraiment quelque chose à raconter.
						</p>
					</div>

					<div className={styles.lettreFormulaire}>
						<NewsletterForm source='blog' libelle='S’inscrire' />
					</div>
				</div>
			</section>
		</>
	);
}
