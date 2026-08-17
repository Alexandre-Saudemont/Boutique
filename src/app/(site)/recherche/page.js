import Link from 'next/link';
import {Search} from 'lucide-react';
import {searchProducts} from '@/server/services/products';
import {rechercherArticles} from '@/server/services/posts';
import {getRayons} from '@/server/services/categories';
import {getSettings} from '@/server/services/settings';
import {pluriel} from '@/lib/format';
import ProductCard from '@/components/ProductCard/ProductCard';
import styles from './recherche.module.css';

/* La recherche.

   Elle vit dans l'URL, comme les filtres de la boutique : `/recherche?q=mecha`
   se partage, se met en favori, et la page reste un composant serveur — la
   requête part une fois, pas à chaque frappe. Le formulaire est un vrai
   formulaire GET, qui fonctionne sans JavaScript.

   Les suggestions ne sont pas une liste écrite à la main : ce sont les rayons
   réels du catalogue. Proposer « Rétro-gaming » à quelqu'un alors que le rayon
   n'existe pas, c'est promettre une étagère vide. */

export const metadata = {
	title: 'Rechercher',
	description: 'Cherchez une pièce, un univers ou un article du blog dans toute la caverne.',
	// Une page de résultats n'a rien à faire dans un index : chaque requête
	// créerait une adresse de plus, sans contenu propre.
	robots: {index: false},
};

const FILTRES = [
	{cle: null, libelle: 'Tout'},
	{cle: 'produits', libelle: 'Produits'},
	{cle: 'articles', libelle: 'Blog'},
];

export default async function Recherche({searchParams}) {
	const parametres = await searchParams;

	const requete = String(parametres.q ?? '').trim();
	const filtre = FILTRES.some((f) => f.cle === parametres.type) ? parametres.type : null;

	const cherche = requete.length >= 2;

	const [produits, articles, rayons, reglages] = await Promise.all([
		cherche && filtre !== 'articles' ? searchProducts(requete) : [],
		cherche && filtre !== 'produits' ? rechercherArticles(requete) : [],
		getRayons(),
		getSettings(),
	]);

	const total = produits.length + articles.length;
	const boutiqueOuverte = Boolean(reglages['shop.open']);

	/// Conserve la requête en changeant de filtre — sinon le clic la perdrait.
	function lienFiltre(cle) {
		const params = new URLSearchParams();
		if (requete) params.set('q', requete);
		if (cle) params.set('type', cle);

		return `/recherche?${params.toString()}`;
	}

	return (
		<section className={styles.section}>
			<form className={styles.barre} role='search'>
				<span className={styles.loupe} aria-hidden='true'>
					<Search size={20} strokeWidth={2.75} />
				</span>

				{/* Le filtre suit la requête d'une recherche à l'autre : quelqu'un qui
				    a restreint au blog ne veut pas repartir de « Tout » à chaque mot. */}
				{filtre && <input type='hidden' name='type' value={filtre} />}

				<input
					className={`input ${styles.champ}`}
					type='search'
					name='q'
					defaultValue={requete}
					placeholder='Rechercher une pièce, un univers…'
					aria-label='Recherche'
					autoFocus
				/>
			</form>

			<div className={styles.entete}>
				<h1 className={styles.titre}>
					{!cherche
						? 'Que cherchez-vous ?'
						: total > 0
							? `${pluriel(total, 'résultat', 'résultats')} pour « ${requete} »`
							: `Aucun résultat pour « ${requete} »`}
				</h1>

				{cherche && (
					<div className={styles.filtres}>
						{FILTRES.map((entree) => (
							<Link
								key={entree.libelle}
								href={lienFiltre(entree.cle)}
								className={`${styles.filtre} ${
									filtre === entree.cle ? styles.filtreActif : ''
								}`}
								aria-current={filtre === entree.cle ? 'true' : undefined}>
								{entree.libelle}
							</Link>
						))}
					</div>
				)}
			</div>

			{produits.length > 0 && (
				<div className={styles.groupe}>
					{articles.length > 0 && <h2 className={styles.titreGroupe}>Dans la boutique</h2>}

					<div className={styles.resultats}>
						{produits.map((produit) => (
							<ProductCard
								key={produit.id}
								produit={produit}
								boutiqueOuverte={boutiqueOuverte}
							/>
						))}
					</div>
				</div>
			)}

			{articles.length > 0 && (
				<div className={styles.groupe}>
					{produits.length > 0 && <h2 className={styles.titreGroupe}>Sur le blog</h2>}

					<div className={styles.articles}>
						{articles.map((article) => (
							<article key={article.id} className={styles.article}>
								{article.categorie && (
									<span className={styles.articleCategorie}>{article.categorie}</span>
								)}

								<h3 className={styles.articleTitre}>
									<Link href={`/blog/${article.slug}`}>{article.titre}</Link>
								</h3>

								{article.chapeau && <p className={styles.articleChapeau}>{article.chapeau}</p>}
							</article>
						))}
					</div>
				</div>
			)}

			{cherche && total === 0 && (
				<div className={styles.vide}>
					<span className={styles.videIcone} aria-hidden='true'>
						<Search size={32} strokeWidth={2.75} />
					</span>

					<h2 className={styles.videTitre}>Rien trouvé dans la caverne</h2>

					<p className={styles.videTexte}>
						Essayez un autre mot-clé, ou fouillez directement les rayons — il y a peut-être une
						trouvaille qui vous attend.
					</p>

					<Link href='/boutique' className='btn btn-primary' style={{padding: '12px 24px'}}>
						Explorer la boutique
					</Link>
				</div>
			)}

			{rayons.length > 0 && (
				<div className={styles.suggestions}>
					<h2 className={styles.titreSuggestions}>Fouiller par rayon</h2>

					<div className={styles.listeSuggestions}>
						{rayons.map((rayon) => (
							<Link
								key={rayon.id}
								href={`/boutique?rayon=${encodeURIComponent(rayon.slug)}`}
								className='tag tag-neutral'>
								{rayon.name}
							</Link>
						))}
					</div>
				</div>
			)}
		</section>
	);
}
