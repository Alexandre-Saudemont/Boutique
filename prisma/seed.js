import {existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import prismaClient from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';

/* @prisma/client est publié en CommonJS. Le bundler de Next sait en extraire
   les exports nommés, mais Node lancé directement — comme ici — n'en voit que
   l'export par défaut. D'où ce déballage manuel. */
const {PrismaClient} = prismaClient;
import {hashPassword} from '../src/server/auth/password.js';

/* Seed : les données sans lesquelles la boutique ne peut pas tourner.
   Pas de faux produits ici — le catalogue viendra du back-office.

   Idempotent : chaque enregistrement passe par un upsert sur sa clé naturelle,
   donc relancer le seed sur une base déjà remplie ne crée pas de doublon et
   n'écrase pas ce que le client a modifié depuis l'admin. */

if (existsSync('.env')) {
	process.loadEnvFile('.env');
}

const prisma = new PrismaClient({
	adapter: new PrismaPg({connectionString: process.env.DATABASE_URL}),
});

/* Les rayons repris tels quels du design (menu « Rayons » du header).
   `meta` alimente la description affichée sous le nom dans le menu déroulant. */
const RAYONS = [
	{
		name: 'Figurines',
		slug: 'figurines',
		description: 'Manga, anime, mécha, résine',
	},
	{
		name: 'Goodies',
		slug: 'goodies',
		description: 'Textile, mugs, print, rétro-gaming',
	},
	{
		name: 'Jeux de société',
		slug: 'jeux-de-societe',
		description: 'Familial, expert, ambiance',
	},
	{
		name: 'JDR & wargame',
		slug: 'jdr-wargame',
		description: 'Univers, dés, écrans, figs à peindre',
	},
	/* Présent dans les filtres de la page Boutique du design, mais absent du
	   menu « Rayons » du header — une incohérence de la maquette. Les mangas
	   étant au cœur du cahier des charges, on garde le rayon. */
	{
		name: 'Mangas & BD',
		slug: 'mangas-bd',
		description: 'Séries, intégrales, artbooks',
	},
	{
		name: 'Box surprise',
		slug: 'box-surprise',
		description: 'Un thème, une taille, une pioche',
	},
	{
		name: 'Ouvrages du geek',
		slug: 'ouvrages-du-geek',
		description: 'Créations & tirages numériques',
	},
];

const CATEGORIES_BLOG = [
	{name: 'Culture', slug: 'culture'},
	{name: 'Coup de cœur', slug: 'coup-de-coeur'},
	{name: 'Atelier', slug: 'atelier'},
	{name: 'Rétro-gaming', slug: 'retro-gaming'},
	{name: 'Actu', slug: 'actu'},
];

/* Réglages modifiables depuis l'admin, sans redéploiement.
   Le seuil de franco (50 €) est répété dans le bandeau du header et dans le
   récapitulatif du panier : il doit venir d'ici, pas d'une constante en dur. */
const REGLAGES = [
	{key: 'shop.name', value: "L'antre du vieux geek fou"},
	{key: 'shop.open', value: false}, // « ouverture imminente » : pas encore de vente
	{key: 'shop.announcement', value: 'Livraison offerte dès 50 € · Point relais Mondial Relay · Paiement sécurisé CB & PayPal'},
	{key: 'vat.regime', value: 'FRANCHISE'}, // art. 293 B du CGI
	{key: 'shipping.freeAboveCents', value: 5000},
	{key: 'order.minimumCents', value: 0}, // en attente de réponse du client
	{key: 'checkout.guestAllowed', value: true}, // en attente de réponse du client
	{key: 'reviews.moderation', value: 'PRIOR'}, // avis validés avant publication
];

async function seedRayons() {
	for (const [position, rayon] of RAYONS.entries()) {
		await prisma.category.upsert({
			where: {slug: rayon.slug},
			update: {},
			create: {...rayon, position},
		});
	}
	console.log(`  ${RAYONS.length} rayons`);
}

async function seedCategoriesBlog() {
	for (const categorie of CATEGORIES_BLOG) {
		await prisma.postCategory.upsert({
			where: {slug: categorie.slug},
			update: {},
			create: categorie,
		});
	}
	console.log(`  ${CATEGORIES_BLOG.length} catégories de blog`);
}

async function seedLivraison() {
	/* ShippingZone n'a pas de clé naturelle unique : on cherche par nom.
	   Les tarifs viennent de la maquette du tunnel de commande. */
	let zone = await prisma.shippingZone.findFirst({where: {name: 'France métropolitaine'}});

	if (!zone) {
		zone = await prisma.shippingZone.create({
			data: {name: 'France métropolitaine', countries: ['FR']},
		});
	}

	const tarifs = [
		{
			name: 'Retrait à l’atelier',
			carrier: 'Atelier',
			priceCents: 0,
			isRelayPoint: false,
			estimatedDays: 'Sur rendez-vous',
			position: 0,
		},
		{
			name: 'Point relais Mondial Relay',
			carrier: 'Mondial Relay',
			priceCents: 390,
			isRelayPoint: true,
			freeAboveCents: 5000,
			estimatedDays: '3 à 5 jours ouvrés',
			position: 1,
		},
		{
			name: 'Colissimo domicile',
			carrier: 'Colissimo',
			priceCents: 590,
			isRelayPoint: false,
			freeAboveCents: 5000,
			estimatedDays: '2 à 4 jours ouvrés',
			position: 2,
		},
	];

	for (const tarif of tarifs) {
		const existant = await prisma.shippingRate.findFirst({
			where: {zoneId: zone.id, name: tarif.name},
		});

		if (!existant) {
			await prisma.shippingRate.create({data: {...tarif, zoneId: zone.id}});
		}
	}

	console.log(`  1 zone de livraison, ${tarifs.length} tarifs`);
}

async function seedReglages() {
	for (const reglage of REGLAGES) {
		await prisma.setting.upsert({
			where: {key: reglage.key},
			update: {}, // ne jamais écraser un réglage modifié depuis l'admin
			create: reglage,
		});
	}
	console.log(`  ${REGLAGES.length} réglages`);
}

async function seedAdmin() {
	const email = process.env.ADMIN_EMAIL;

	if (!email) {
		console.log('  compte admin ignoré (ADMIN_EMAIL absent du .env)');
		return;
	}

	const existant = await prisma.user.findUnique({where: {email}});

	if (existant) {
		console.log('  compte admin déjà présent, inchangé');
		return;
	}

	/* Si aucun mot de passe n'est fourni, on en tire un au hasard et on l'affiche
	   une seule fois. Mieux qu'un mot de passe par défaut en dur, que personne ne
	   pense jamais à changer et qui finit publié dans le dépôt. */
	const genere = !process.env.ADMIN_PASSWORD;
	const motDePasse = process.env.ADMIN_PASSWORD || randomBytes(18).toString('base64url');

	await prisma.user.create({
		data: {
			email,
			passwordHash: await hashPassword(motDePasse),
			role: 'ADMIN',
			firstName: 'Le Vieux geek',
			emailVerifiedAt: new Date(),
		},
	});

	console.log(`  compte admin créé : ${email}`);

	if (genere) {
		console.log('');
		console.log('  ┌─ Mot de passe généré — notez-le, il ne sera plus affiché :');
		console.log(`  │  ${motDePasse}`);
		console.log('  └─');
		console.log('');
	}
}

async function main() {
	console.log('Seed de la boutique :');

	await seedRayons();
	await seedCategoriesBlog();
	await seedLivraison();
	await seedReglages();
	await seedAdmin();

	console.log('Terminé.');
}

main()
	.catch((erreur) => {
		console.error('Le seed a échoué :', erreur);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
