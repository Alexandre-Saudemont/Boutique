import {getAllProductSlugs} from '@/server/services/products';
import {getAllPostSlugs} from '@/server/services/posts';
import {getRayons} from '@/server/services/categories';
import {adresseDuSite} from '@/lib/site-url';

/* Le plan du site, servi sur `/sitemap.xml`.

   Ce qu'on y met : les pages qu'un inconnu doit pouvoir trouver depuis un
   moteur. Ce qu'on n'y met pas, et c'est le plus important — le panier, le
   tunnel de commande, l'espace compte, les liens de téléchargement, le
   back-office. Ces pages sont soit personnelles, soit sans intérêt hors
   contexte ; une adresse de téléchargement indexée serait franchement une
   fuite. `robots.js` les interdit en plus, mais le premier filtre est ici :
   ce qui n'est pas listé n'est pas proposé.

   Les rayons figurent sous forme de `/boutique?rayon=…`. Le filtre vit dans
   l'URL et non dans un état React, précisément pour que chaque rayon soit une
   page à part entière — autant la déclarer.

   Les `lastModified` viennent de la base. C'est ce qui évite qu'un moteur
   recharge tout le catalogue à chaque passage pour découvrir que rien n'a
   bougé. */

/* Le sitemap est régénéré une fois par heure plutôt qu'à chaque requête : une
   publication n'a pas à être annoncée à la seconde, et le fichier interroge
   trois tables. */
export const revalidate = 3600;

/* Les pages qui ne dépendent pas de la base. La priorité n'est qu'un indice
   relatif à notre propre site — elle dit à un moteur ce qui compte le plus ici,
   pas comment nous situer face aux autres. */
const PAGES_FIXES = [
	{chemin: '/', priorite: 1, frequence: 'daily'},
	{chemin: '/boutique', priorite: 0.9, frequence: 'daily'},
	{chemin: '/box', priorite: 0.7, frequence: 'weekly'},
	{chemin: '/ichiban-kuji', priorite: 0.5, frequence: 'monthly'},
	{chemin: '/blog', priorite: 0.6, frequence: 'weekly'},
	{chemin: '/a-propos', priorite: 0.5, frequence: 'monthly'},
	{chemin: '/contact', priorite: 0.5, frequence: 'monthly'},
	{chemin: '/legal', priorite: 0.3, frequence: 'yearly'},
];

export default async function sitemap() {
	const site = adresseDuSite();

	/* Les trois lectures sont indépendantes : les enchaîner ferait trois
	   allers-retours en base là où un seul suffit. */
	const [produits, articles, rayons] = await Promise.all([
		getAllProductSlugs(),
		getAllPostSlugs(),
		getRayons(),
	]);

	const maintenant = new Date();

	return [
		...PAGES_FIXES.map(({chemin, priorite, frequence}) => ({
			url: `${site}${chemin}`,
			lastModified: maintenant,
			changeFrequency: frequence,
			priority: priorite,
		})),

		...rayons.map((rayon) => ({
			url: `${site}/boutique?rayon=${encodeURIComponent(rayon.slug)}`,
			lastModified: maintenant,
			changeFrequency: 'daily',
			priority: 0.8,
		})),

		...produits.map((produit) => ({
			url: `${site}/produit/${produit.slug}`,
			lastModified: produit.updatedAt,
			changeFrequency: 'weekly',
			priority: 0.8,
		})),

		...articles.map((article) => ({
			url: `${site}/blog/${article.slug}`,
			lastModified: article.updatedAt,
			changeFrequency: 'monthly',
			priority: 0.5,
		})),
	];
}
