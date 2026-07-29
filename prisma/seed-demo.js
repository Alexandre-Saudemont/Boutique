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

	console.log(
		crees > 0
			? `Catalogue de démonstration : ${crees} produits créés.`
			: 'Catalogue de démonstration déjà en place, rien à faire.',
	);
}

main()
	.catch((erreur) => {
		console.error('Le seed de démonstration a échoué :', erreur);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
