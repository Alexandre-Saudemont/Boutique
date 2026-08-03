import 'server-only';
import {prisma} from '@/server/db';
import {slugifier} from '@/lib/slug';

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

/* ── Back-office ────────────────────────────────────────────────────────────
   À partir d'ici, les lectures ne filtrent plus sur la publication : c'est
   justement le brouillon qu'on vient chercher pour le finir. */

/// Tous les articles, brouillons compris, du plus récemment touché au plus
/// ancien — l'ordre dans lequel on reprend un texte en cours.
export async function listerArticlesAdmin() {
	return prisma.post.findMany({
		orderBy: {updatedAt: 'desc'},
		take: 200,
		select: {
			id: true,
			title: true,
			slug: true,
			status: true,
			publishedAt: true,
			updatedAt: true,
			categories: {select: {name: true}, take: 1},
		},
	});
}

export async function getArticlePourEdition(id) {
	return prisma.post.findUnique({where: {id}});
}

/// Un slug libre. Même logique que pour les produits : on suffixe plutôt que de
/// refuser, deux articles peuvent porter le même titre à un an d'intervalle.
async function slugLibre(titre, idAExclure = null) {
	const base = slugifier(titre) || 'article';

	const voisins = await prisma.post.findMany({
		where: {slug: {startsWith: base}, ...(idAExclure ? {id: {not: idAExclure}} : {})},
		select: {slug: true},
	});

	const pris = new Set(voisins.map((article) => article.slug));
	if (!pris.has(base)) return base;

	let rang = 2;
	while (pris.has(`${base}-${rang}`)) rang += 1;

	return `${base}-${rang}`;
}

/* Crée ou met à jour un article.

   Le contenu est stocké tel quel, en texte. Il est rendu comme du texte côté
   vitrine, jamais injecté en HTML : accepter du HTML dans un champ qui finit
   dans une page, c'est ouvrir la porte à l'injection de script. Le jour où le
   client voudra de la mise en forme, ce sera du Markdown converti au rendu,
   avec une liste de balises autorisée. */
export async function enregistrerArticle({id, titre, chapeau, contenu, image, statut, auteurId}) {
	const titrePropre = String(titre ?? '').trim();
	const contenuPropre = String(contenu ?? '').trim();

	const erreurs = {};
	if (!titrePropre) erreurs.titre = 'Le titre est obligatoire.';
	if (!contenuPropre) erreurs.contenu = 'Un article sans texte n’a rien à publier.';

	if (Object.keys(erreurs).length > 0) return {ok: false, erreurs};

	const publie = statut === 'PUBLISHED';

	const donnees = {
		title: titrePropre,
		excerpt: String(chapeau ?? '').trim() || null,
		content: contenuPropre,
		coverImageUrl: String(image ?? '').trim() || null,
		status: publie ? 'PUBLISHED' : 'DRAFT',
	};

	if (id) {
		const existant = await prisma.post.findUnique({
			where: {id},
			select: {id: true, title: true, slug: true, publishedAt: true, status: true},
		});

		if (!existant) return {ok: false, erreurs: {titre: 'Article introuvable.'}};

		// Comme pour les produits : le slug se fige à la première publication, il
		// est dès lors dans les liens partagés.
		const slug =
			existant.status === 'PUBLISHED' || existant.title === titrePropre
				? existant.slug
				: await slugLibre(titrePropre, existant.id);

		const article = await prisma.post.update({
			where: {id: existant.id},
			data: {
				...donnees,
				slug,
				publishedAt: publie ? (existant.publishedAt ?? new Date()) : null,
			},
		});

		return {ok: true, id: article.id};
	}

	const article = await prisma.post.create({
		data: {
			...donnees,
			slug: await slugLibre(titrePropre),
			publishedAt: publie ? new Date() : null,
			authorId: auteurId ?? null,
		},
	});

	return {ok: true, id: article.id};
}

/// Dépublie un article : il repasse en brouillon, il n'est pas effacé. Le texte
/// a coûté du temps à écrire, et une suppression ne se rattrape pas.
export async function depublierArticle(id) {
	await prisma.post.update({where: {id}, data: {status: 'DRAFT', publishedAt: null}});

	return {ok: true};
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
