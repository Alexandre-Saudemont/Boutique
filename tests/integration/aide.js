import {prisma} from '@/server/db';

/* Outillage des tests d'intégration.

   Ces tests parlent à une vraie base — celle de `TEST_DATABASE_URL`, jamais
   celle de développement. C'est le prix à payer pour vérifier ce qui compte
   vraiment : les clauses `where` qui isolent un panier d'un autre, les
   transactions, les contraintes d'unicité. Un faux client Prisma validerait
   surtout la qualité du faux.

   Chaque test repart d'une base vide. Plutôt que de supprimer ce qu'on croit
   avoir créé — et d'oublier une table au premier ajout de fonctionnalité — on
   vide tout, en une commande. */

export const baseDisponible = Boolean(process.env.TEST_DATABASE_URL);

/* `TRUNCATE ... CASCADE` suit les clés étrangères tout seul : inutile de tenir
   à jour l'ordre de suppression. `RESTART IDENTITY` remet les séquences à zéro,
   pour que deux exécutions donnent exactement les mêmes résultats. */
export async function viderLaBase() {
	await prisma.$executeRawUnsafe(`
		TRUNCATE TABLE
			download_grants, digital_assets, box_contents,
			order_items, order_addresses, payments, orders,
			cart_items, carts,
			product_images, variant_options, product_variants, products,
			reviews, wishlist_items, addresses,
			categories, brands, licences,
			audit_logs, verification_tokens, sessions, users,
			discount_codes, newsletter_subscribers, settings, shipping_rates, shipping_zones,
			posts
		RESTART IDENTITY CASCADE
	`);
}

/// La boutique ouverte, sans minimum de commande : l'état par défaut attendu
/// par la plupart des tests. Sans ça, chaque ajout au panier serait refusé.
export async function ouvrirLaBoutique(reglages = {}) {
	const valeurs = {
		'shop.open': true,
		'order.minimumCents': 0,
		'shipping.freeAboveCents': 5000,
		'vat.regime': 'FRANCHISE',
		...reglages,
	};

	for (const [key, value] of Object.entries(valeurs)) {
		await prisma.setting.upsert({where: {key}, update: {value}, create: {key, value}});
	}
}

let compteur = 0;

/* Un produit publié avec une variante, prêt à être acheté.

   Les valeurs par défaut décrivent le cas courant ; chaque test surcharge ce
   qui l'intéresse (le stock, le prix, la publication) sans avoir à réécrire
   toute la fixture. */
export async function creerProduit({
	nom = 'Rônin des Cerisiers',
	prixCents = 7490,
	stock = 5,
	publie = true,
	actif = true,
	allowBackorder = false,
	allowPreorder = false,
} = {}) {
	compteur += 1;

	return prisma.product.create({
		data: {
			name: nom,
			slug: `produit-test-${compteur}`,
			isActive: actif,
			allowPreorder,
			publishedAt: publie ? new Date('2026-01-01') : null,
			variants: {
				create: {
					sku: `SKU-TEST-${compteur}`,
					name: 'Standard',
					priceCents: prixCents,
					stock,
					allowBackorder,
				},
			},
		},
		include: {variants: true},
	});
}

/// Un mode de livraison réel : le tunnel refuse de créer une commande sans lui.
export async function creerModeLivraison({prixCents = 590, francoCents = 5000} = {}) {
	const zone = await prisma.shippingZone.create({
		data: {name: 'France métropolitaine', countries: ['FR']},
	});

	return prisma.shippingRate.create({
		data: {
			zoneId: zone.id,
			name: 'Colissimo à domicile',
			carrier: 'La Poste',
			priceCents: prixCents,
			freeAboveCents: francoCents,
			estimatedDays: '2 à 3 jours',
			isActive: true,
		},
	});
}

export {prisma};
