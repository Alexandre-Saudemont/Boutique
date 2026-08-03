import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {addItem} from '@/server/services/cart';
import {creerCommande, getCommande} from '@/server/services/checkout';
import {changerStatutCommande} from '@/server/services/orders';
import {
	baseDisponible,
	creerModeLivraison,
	creerProduit,
	ouvrirLaBoutique,
	prisma,
	viderLaBase,
} from './aide';

/* Le tunnel de commande, de bout en bout.

   Ce fichier vérifie les trois promesses tenues au client et au comptable : le
   montant débité est celui que le serveur calcule, une commande est figée à
   l'émission, et personne ne lit la facture de quelqu'un d'autre. */

const adresse = {
	firstName: 'Camille',
	lastName: 'Durand',
	line1: '12 rue des Lilas',
	postalCode: '69003',
	city: 'Lyon',
	email: 'Camille@Exemple.FR',
};

describe.skipIf(!baseDisponible)('création de commande', () => {
	let mode;

	beforeAll(() => {
		expect(process.env.DATABASE_URL).toContain('_test');
	});

	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
		mode = await creerModeLivraison({prixCents: 590, francoCents: 5000});
	});

	it('crée une commande complète à partir du panier', async () => {
		const produit = await creerProduit({prixCents: 2000, stock: 5});
		await addItem('jeton-a', produit.variants[0].id, 2);

		const resultat = await creerCommande({token: 'jeton-a', adresse, rateId: mode.id});

		expect(resultat.ok).toBe(true);
		expect(resultat.numero).toMatch(/^AVGF-\d{4}-\d{6}$/);

		const commande = await prisma.order.findUnique({
			where: {id: resultat.id},
			include: {items: true, addresses: true, payments: true},
		});

		expect(commande.status).toBe('PENDING_PAYMENT');
		expect(commande.subtotalCents).toBe(4000);
		expect(commande.shippingCents).toBe(590);
		expect(commande.totalCents).toBe(4590);
		expect(commande.items).toHaveLength(1);
		expect(commande.addresses).toHaveLength(1);
		expect(commande.payments[0].status).toBe('PENDING');
		expect(commande.payments[0].amountCents).toBe(4590);
	});

	it('normalise l’e-mail : c’est la clé de relecture de la commande', async () => {
		const produit = await creerProduit();
		await addItem('jeton-a', produit.variants[0].id, 1);

		const resultat = await creerCommande({token: 'jeton-a', adresse, rateId: mode.id});
		const commande = await prisma.order.findUnique({where: {id: resultat.id}});

		expect(commande.email).toBe('camille@exemple.fr');
	});

	it('applique le franco de port au-delà du seuil', async () => {
		const produit = await creerProduit({prixCents: 6000, stock: 3});
		await addItem('jeton-a', produit.variants[0].id, 1);

		const resultat = await creerCommande({token: 'jeton-a', adresse, rateId: mode.id});
		const commande = await prisma.order.findUnique({where: {id: resultat.id}});

		expect(commande.shippingCents).toBe(0);
		expect(commande.totalCents).toBe(6000);
	});

	it('fige les prix : une hausse ultérieure ne réécrit pas la facture', async () => {
		const produit = await creerProduit({prixCents: 2000, stock: 5});
		await addItem('jeton-a', produit.variants[0].id, 1);

		const resultat = await creerCommande({token: 'jeton-a', adresse, rateId: mode.id});

		await prisma.productVariant.update({
			where: {id: produit.variants[0].id},
			data: {priceCents: 9999},
		});

		const commande = await prisma.order.findUnique({
			where: {id: resultat.id},
			include: {items: true},
		});

		expect(commande.items[0].unitPriceCents).toBe(2000);
		expect(commande.totalCents).toBe(2590);
	});

	it('copie le nom du produit : le renommer ne change pas la commande passée', async () => {
		const produit = await creerProduit({nom: 'Rônin des Cerisiers'});
		await addItem('jeton-a', produit.variants[0].id, 1);

		const resultat = await creerCommande({token: 'jeton-a', adresse, rateId: mode.id});

		await prisma.product.update({where: {id: produit.id}, data: {name: 'Autre nom'}});

		const commande = await prisma.order.findUnique({
			where: {id: resultat.id},
			include: {items: true},
		});

		expect(commande.items[0].productName).toBe('Rônin des Cerisiers');
	});

	it('refuse un panier vide', async () => {
		const resultat = await creerCommande({token: 'jeton-vide', adresse, rateId: mode.id});

		expect(resultat.ok).toBe(false);
		expect(await prisma.order.count()).toBe(0);
	});

	it('refuse un mode de livraison inventé — le prix ne vient jamais du navigateur', async () => {
		const produit = await creerProduit();
		await addItem('jeton-a', produit.variants[0].id, 1);

		const resultat = await creerCommande({
			token: 'jeton-a',
			adresse,
			rateId: 'livraison-gratuite-inventee',
		});

		expect(resultat.ok).toBe(false);
		expect(await prisma.order.count()).toBe(0);
	});

	it('refuse une adresse incomplète, sans rien écrire', async () => {
		const produit = await creerProduit();
		await addItem('jeton-a', produit.variants[0].id, 1);

		const resultat = await creerCommande({
			token: 'jeton-a',
			adresse: {...adresse, postalCode: ''},
			rateId: mode.id,
		});

		expect(resultat.ok).toBe(false);
		expect(await prisma.order.count()).toBe(0);
	});

	it('refuse de commander quand la boutique est fermée', async () => {
		const produit = await creerProduit();
		await addItem('jeton-a', produit.variants[0].id, 1);
		await ouvrirLaBoutique({'shop.open': false});

		expect((await creerCommande({token: 'jeton-a', adresse, rateId: mode.id})).ok).toBe(false);
	});

	it('respecte le montant minimum de commande', async () => {
		await ouvrirLaBoutique({'order.minimumCents': 1500});
		const produit = await creerProduit({prixCents: 400});
		await addItem('jeton-a', produit.variants[0].id, 1);

		expect((await creerCommande({token: 'jeton-a', adresse, rateId: mode.id})).ok).toBe(false);
	});

	it('vide le panier par défaut, et le garde quand un paiement en ligne suit', async () => {
		const produit = await creerProduit({stock: 9});

		await addItem('jeton-a', produit.variants[0].id, 1);
		await creerCommande({token: 'jeton-a', adresse, rateId: mode.id});
		expect(await prisma.cartItem.count()).toBe(0);

		await addItem('jeton-a', produit.variants[0].id, 1);
		await creerCommande({token: 'jeton-a', adresse, rateId: mode.id, viderPanier: false});
		expect(await prisma.cartItem.count()).toBe(1);
	});

	it('numérote sans trou et sans doublon', async () => {
		const produit = await creerProduit({stock: 9});

		const numeros = [];
		for (let i = 0; i < 3; i += 1) {
			await addItem('jeton-a', produit.variants[0].id, 1);
			numeros.push((await creerCommande({token: 'jeton-a', adresse, rateId: mode.id})).numero);
		}

		expect(new Set(numeros).size).toBe(3);
		expect(numeros[0].endsWith('000001')).toBe(true);
		expect(numeros[2].endsWith('000003')).toBe(true);
	});

	it('ne décrémente pas le stock avant le paiement', async () => {
		// Réserver dès la commande laisserait chaque panier abandonné bloquer des
		// pièces. C'est la confirmation de paiement qui décrémente.
		const produit = await creerProduit({stock: 5});
		await addItem('jeton-a', produit.variants[0].id, 2);

		await creerCommande({token: 'jeton-a', adresse, rateId: mode.id});

		const variante = await prisma.productVariant.findUnique({where: {id: produit.variants[0].id}});
		expect(variante.stock).toBe(5);
	});
});

describe.skipIf(!baseDisponible)('relecture d’une commande', () => {
	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
	});

	it('exige le numéro et l’e-mail', async () => {
		const mode = await creerModeLivraison();
		const produit = await creerProduit();
		await addItem('jeton-a', produit.variants[0].id, 1);
		const {numero} = await creerCommande({token: 'jeton-a', adresse, rateId: mode.id});

		expect(await getCommande(numero, 'camille@exemple.fr')).not.toBeNull();

		// Le numéro seul est court et se devine : il ne doit pas suffire.
		expect(await getCommande(numero, 'curieux@ailleurs.fr')).toBeNull();
		expect(await getCommande(numero, '')).toBeNull();
		expect(await getCommande(numero, null)).toBeNull();
	});

	it('accepte l’e-mail quelle qu’en soit la casse', async () => {
		const mode = await creerModeLivraison();
		const produit = await creerProduit();
		await addItem('jeton-a', produit.variants[0].id, 1);
		const {numero} = await creerCommande({token: 'jeton-a', adresse, rateId: mode.id});

		expect(await getCommande(numero, '  CAMILLE@exemple.fr ')).not.toBeNull();
	});
});

describe.skipIf(!baseDisponible)('avancement d’une commande', () => {
	let numero;
	let produit;

	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();

		const mode = await creerModeLivraison();
		produit = await creerProduit({stock: 5});
		await addItem('jeton-a', produit.variants[0].id, 2);

		const resultat = await creerCommande({token: 'jeton-a', adresse, rateId: mode.id});
		numero = resultat.numero;
	});

	it('refuse une transition non prévue', async () => {
		// Une commande impayée ne s'expédie pas.
		const resultat = await changerStatutCommande({numero, statut: 'SHIPPED'});

		expect(resultat.ok).toBe(false);

		const commande = await prisma.order.findUnique({where: {orderNumber: numero}});
		expect(commande.status).toBe('PENDING_PAYMENT');
	});

	it('refuse un statut qui n’existe pas', async () => {
		expect((await changerStatutCommande({numero, statut: 'GRATUITE'})).ok).toBe(false);
	});

	it('horodate l’expédition et enregistre le suivi', async () => {
		await prisma.order.update({where: {orderNumber: numero}, data: {status: 'PAID'}});
		await changerStatutCommande({numero, statut: 'PREPARING'});

		const resultat = await changerStatutCommande({
			numero,
			statut: 'SHIPPED',
			suivi: ' 6A12345678901 ',
			transporteur: 'Colissimo',
		});

		expect(resultat.ok).toBe(true);

		const commande = await prisma.order.findUnique({where: {orderNumber: numero}});
		expect(commande.status).toBe('SHIPPED');
		expect(commande.shippedAt).toBeInstanceOf(Date);
		expect(commande.trackingNumber).toBe('6A12345678901');
		expect(commande.carrier).toBe('Colissimo');
	});

	it('rend les pièces au stock quand une commande payée est annulée', async () => {
		await prisma.productVariant.update({
			where: {id: produit.variants[0].id},
			data: {stock: 3}, // comme si le paiement avait décrémenté
		});
		await prisma.order.update({where: {orderNumber: numero}, data: {status: 'PAID'}});

		await changerStatutCommande({numero, statut: 'CANCELLED'});

		const variante = await prisma.productVariant.findUnique({where: {id: produit.variants[0].id}});
		expect(variante.stock).toBe(5);
	});

	it('ne rend rien au stock quand la commande n’a jamais été payée', async () => {
		// Une commande impayée n'a rien retiré : lui « rendre » des pièces
		// créerait du stock à partir de rien.
		await changerStatutCommande({numero, statut: 'CANCELLED'});

		const variante = await prisma.productVariant.findUnique({where: {id: produit.variants[0].id}});
		expect(variante.stock).toBe(5);
	});

	it('refuse d’avancer une commande inconnue', async () => {
		expect((await changerStatutCommande({numero: 'AVGF-2026-999999', statut: 'PAID'})).ok).toBe(
			false,
		);
	});
});
