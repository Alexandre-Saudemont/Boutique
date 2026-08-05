import {existsSync} from 'node:fs';
import prismaClient from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';

/* Catalogue de démonstration — développement uniquement.

   Volontairement séparé de seed.js : celui-là installe ce sans quoi la boutique
   ne tourne pas et sera joué en production. Celui-ci ne sert qu'à avoir des
   pièces à l'écran tant que le client n'a pas saisi son stock. Les produits
   sont ceux de la maquette, pour pouvoir comparer le rendu au design.

   Lancer avec : npm run db:seed:demo
   Refuse de tourner en production — une boutique réelle ne doit jamais se
   retrouver avec ces neuf articles dans ses rayons.

   Idempotent : les produits sont repérés par leur slug. Aucune image : le
   design prévoit des emplacements vides, les vraies photos viendront du
   back-office. */

if (existsSync('.env')) {
	process.loadEnvFile('.env');
}

if (process.env.NODE_ENV === 'production') {
	console.error('Refus : ce seed de démonstration ne doit pas tourner en production.');
	process.exit(1);
}

const {PrismaClient} = prismaClient;

const prisma = new PrismaClient({
	adapter: new PrismaPg({connectionString: process.env.DATABASE_URL}),
});

/* condition + allowPreorder reproduisent les trois états de la maquette :
   Neuf, Occasion, Précommande. */
const PRODUITS = [
	{
		slug: 'ronin-des-cerisiers-1-7',
		name: 'Rônin des Cerisiers — 1/7',
		rayon: 'figurines',
		shortDescription: 'Résine · Édition limitée',
		priceCents: 7490,
		stock: 3,
		condition: 'NEW',
	},
	{
		slug: 'set-de-7-des-nebuleuse',
		name: 'Set de 7 dés — Nébuleuse',
		rayon: 'jdr-wargame',
		shortDescription: 'Résine violette translucide',
		priceCents: 1800,
		stock: 12,
		condition: 'NEW',
	},
	{
		slug: 'mecha-hg-1-144-unite-02',
		name: 'Mecha HG 1/144 — Unité 02',
		rayon: 'figurines',
		shortDescription: 'Maquette à monter',
		priceCents: 2250,
		stock: 0,
		condition: 'NEW',
		allowPreorder: true,
	},
	{
		slug: 'integrale-collector-t1-t3',
		name: 'Intégrale collector — T.1 à 3',
		rayon: 'mangas-bd',
		shortDescription: 'Occasion · très bon état',
		priceCents: 2900,
		stock: 1,
		condition: 'USED',
	},
	{
		slug: 'donjon-de-poche-boite-de-base',
		name: 'Donjon de Poche — boîte de base',
		rayon: 'jeux-de-societe',
		shortDescription: 'Familial · 2–5 joueurs',
		priceCents: 3200,
		stock: 6,
		condition: 'NEW',
	},
	{
		slug: 'mug-emaille-pixel-heart',
		name: 'Mug émaillé — Pixel Heart',
		rayon: 'goodies',
		shortDescription: 'Grès · 350 ml',
		priceCents: 1490,
		stock: 20,
		condition: 'NEW',
	},
	{
		slug: 'cartouche-16-bit-aventure-perdue',
		name: 'Cartouche 16-bit — Aventure perdue',
		rayon: 'goodies',
		shortDescription: 'Occasion · testée, garantie',
		priceCents: 4500,
		stock: 1,
		condition: 'USED',
	},
	{
		slug: 'ecran-de-mj-terres-grises',
		name: 'Écran de MJ — Terres Grises',
		rayon: 'jdr-wargame',
		shortDescription: 'Précommande · tirage numéroté',
		priceCents: 2600,
		stock: 0,
		condition: 'NEW',
		allowPreorder: true,
	},
	{
		slug: 'figurine-a-peindre-golem',
		name: 'Figurine à peindre — Golem',
		rayon: 'figurines',
		shortDescription: 'Résine brute · 32 mm',
		priceCents: 950,
		stock: 8,
		condition: 'NEW',
	},
];

/* Quelques articles, pour que le blog ne soit pas une page vide en
   développement. Même principe que les produits : repérés par leur slug, donc
   rejouables sans doublon. Le contenu est du texte brut séparé par des lignes
   vides — c'est exactement ce que le back-office enregistre. */
const ARTICLES = [
	{
		slug: 'peindre-sa-premiere-figurine',
		title: 'Peindre sa première figurine',
		categorie: {nom: 'Atelier', slug: 'atelier'},
		excerpt: 'Trois pinceaux, une lampe de bureau, et beaucoup moins de raisons d’avoir peur qu’on ne croit.',
		content: `On commence tous par la même erreur : trop de peinture sur le pinceau. La figurine se noie, les détails disparaissent sous une couche épaisse, et on range la boîte en se disant qu’on n’est pas doué.

La vérité, c’est qu’il faut diluer. Beaucoup plus qu’on ne l’imagine. Deux couches fines valent mieux qu’une couche franche, et se rattrapent bien plus facilement.

La sous-couche, elle, ne se saute pas. C’est elle qui fait tenir tout le reste. Un aérosol gris à un mètre de distance, par temps sec, et on laisse sécher une nuit entière avant de toucher quoi que ce soit.`,
	},
	{
		slug: 'le-mecha-des-annees-80',
		title: 'Le mécha des années 80',
		categorie: {nom: 'Culture', slug: 'culture'},
		excerpt: 'Pourquoi ces robots dessinés il y a quarante ans tiennent encore debout aujourd’hui.',
		content: `Il y a une raison très simple pour laquelle les méchas de cette époque vieillissent bien : ils ont été dessinés par des gens qui devaient les faire bouger à la main, image par image.

Chaque articulation avait un coût. Chaque détail en trop se payait en semaines de travail. Résultat : des silhouettes lisibles, reconnaissables à la seule ombre.

C’est la même leçon que pour une figurine posée sur une étagère. Ce qu’on retient d’un objet, c’est sa silhouette avant ses détails.`,
	},
	{
		slug: 'chiner-sans-se-faire-avoir',
		title: 'Chiner sans se faire avoir',
		categorie: {nom: 'Coup de cœur', slug: 'coup-de-coeur'},
		excerpt: 'Ce que je regarde, dans l’ordre, avant de sortir un billet sur une brocante.',
		content: `La boîte, toujours. Une boîte fatiguée n’est pas grave ; une boîte qui a pris l’eau annonce presque toujours un contenu abîmé.

Ensuite le poids. Une figurine en résine qui semble légère est souvent une copie. Ça ne se sent qu’à force, mais ça se sent.

Enfin, le vendeur. Quelqu’un qui vous raconte d’où vient la pièce vous dira aussi ce qui cloche avec. Celui qui ne sait rien n’a rien à cacher non plus — il ne sait juste rien.`,
	},
];

/// Crée les articles manquants. Retourne le nombre effectivement créé.
async function semerArticles() {
	let crees = 0;

	for (const article of ARTICLES) {
		const existant = await prisma.post.findUnique({where: {slug: article.slug}});
		if (existant) continue;

		const {categorie, ...champs} = article;

		const rubrique = await prisma.postCategory.upsert({
			where: {slug: categorie.slug},
			update: {},
			create: {name: categorie.nom, slug: categorie.slug},
		});

		await prisma.post.create({
			data: {
				...champs,
				status: 'PUBLISHED',
				publishedAt: new Date(),
				categories: {connect: {id: rubrique.id}},
			},
		});

		crees += 1;
	}

	return crees;
}

async function main() {
	const rayons = await prisma.category.findMany({select: {id: true, slug: true}});
	const idParSlug = Object.fromEntries(rayons.map((r) => [r.slug, r.id]));

	if (rayons.length === 0) {
		console.error('Aucun rayon en base. Lancez d’abord `npm run db:seed`.');
		process.exit(1);
	}

	let crees = 0;

	for (const produit of PRODUITS) {
		const existant = await prisma.product.findUnique({where: {slug: produit.slug}});
		if (existant) continue;

		const {rayon, priceCents, stock, ...champs} = produit;

		await prisma.product.create({
			data: {
				...champs,
				primaryCategoryId: idParSlug[rayon] ?? null,
				publishedAt: new Date(),
				variants: {
					create: {
						// SKU dérivé du slug : lisible, et unique par construction.
						sku: `DEMO-${produit.slug.toUpperCase().slice(0, 24)}`,
						priceCents,
						stock,
						weightGrams: 400,
					},
				},
			},
		});

		crees += 1;
	}

	const articles = await semerArticles();

	console.log(
		crees > 0
			? `Catalogue de démonstration : ${crees} produits créés.`
			: 'Catalogue de démonstration déjà en place, rien à faire.',
	);

	console.log(
		articles > 0
			? `Blog de démonstration : ${articles} articles créés.`
			: 'Blog de démonstration déjà en place, rien à faire.',
	);
}

main()
	.catch((erreur) => {
		console.error('Le seed de démonstration a échoué :', erreur);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
