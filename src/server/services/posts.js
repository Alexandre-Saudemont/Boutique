import 'server-only';
import {prisma} from '@/server/db';

/* Le blog de l'antre.

   Même règle que pour le catalogue : un article n'est public que publié et daté
   dans le passé. `publishedAt` au futur, c'est une publication programmée — elle
   ne doit pas fuiter avant l'heure. */

function conditionsPubliees() {
	return {status: 'PUBLISHED', publishedAt: {not: null, lte: new Date()}};
}

/// Met un article brut de Prisma en forme pour l'affichage.
function pourAffichage(article) {
	return {
		id: article.id,
		titre: article.title,
		slug: article.slug,
		chapeau: article.excerpt,
		image: article.coverImageUrl,
		date: article.publishedAt,
		categorie: article.categories[0]?.name ?? null,
	};
}

/// Les derniers articles, pour l'aperçu de l'accueil.
export async function getLatestPosts(limite = 3) {
	const articles = await prisma.post.findMany({
		where: conditionsPubliees(),
		orderBy: {publishedAt: 'desc'},
		take: limite,
		include: {categories: {select: {name: true}, take: 1}},
	});

	return articles.map(pourAffichage);
}
