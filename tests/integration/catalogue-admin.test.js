import {beforeEach, describe, expect, it} from 'vitest';
import {archiverProduit, enregistrerProduit, restaurerProduit} from '@/server/services/product-admin';
import {listProducts} from '@/server/services/products';
import {addItem} from '@/server/services/cart';
import {baseDisponible, creerProduit, ouvrirLaBoutique, prisma, viderLaBase} from './aide';

/* Écriture du catalogue depuis le back-office.

   Le fil conducteur : rien ne disparaît jamais, et rien de non publié ne fuite
   en vitrine. */

const BASE = {
	nom: 'Rônin des Cerisiers',
	publication: 'BROUILLON',
	variantes: [{id: null, nom: 'Standard', sku: '', prix: '74,90', stock: '3', etat: 'EN_VENTE'}],
	images: [],
};

describe.skipIf(!baseDisponible)('enregistrement d’un produit', () => {
	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
	});

	it('crée le produit, sa variante et son SKU', async () => {
		const resultat = await enregistrerProduit(BASE);

		expect(resultat.ok).toBe(true);

		const produit = await prisma.product.findUnique({
			where: {id: resultat.id},
			include: {variants: true},
		});

		expect(produit.slug).toBe('ronin-des-cerisiers');
		expect(produit.publishedAt).toBeNull(); // brouillon
		expect(produit.variants[0].priceCents).toBe(7490);
		expect(produit.variants[0].stock).toBe(3);
		expect(produit.variants[0].sku).toBeTruthy();
	});

	it('rend le slug unique sans refuser deux produits de même nom', async () => {
		const premier = await enregistrerProduit(BASE);
		const second = await enregistrerProduit(BASE);

		const [a, b] = await Promise.all([
			prisma.product.findUnique({where: {id: premier.id}}),
			prisma.product.findUnique({where: {id: second.id}}),
		]);

		expect(a.slug).toBe('ronin-des-cerisiers');
		expect(b.slug).toBe('ronin-des-cerisiers-2');
	});

	it('garde un brouillon hors de la vitrine', async () => {
		await enregistrerProduit(BASE);

		expect(await listProducts({})).toHaveLength(0);
	});

	it('publie et dépublie sans perdre la date de première publication', async () => {
		const cree = await enregistrerProduit({...BASE, publication: 'EN_LIGNE'});

		const publie = await prisma.product.findUnique({where: {id: cree.id}});
		expect(publie.publishedAt).toBeInstanceOf(Date);
		expect(await listProducts({})).toHaveLength(1);

		await enregistrerProduit({...BASE, id: cree.id, publication: 'BROUILLON'});

		const depublie = await prisma.product.findUnique({where: {id: cree.id}});
		expect(depublie.publishedAt).toBeNull();
		expect(await listProducts({})).toHaveLength(0);
	});

	it('fige le slug une fois le produit publié', async () => {
		/* Après publication, le slug est dans les liens partagés et indexé : le
		   faire suivre une correction de titre casserait ces adresses. */
		const cree = await enregistrerProduit({...BASE, publication: 'EN_LIGNE'});

		await enregistrerProduit({...BASE, id: cree.id, nom: 'Rônin, édition corrigée'});

		const produit = await prisma.product.findUnique({where: {id: cree.id}});
		expect(produit.slug).toBe('ronin-des-cerisiers');
		expect(produit.name).toBe('Rônin, édition corrigée');
	});

	it('laisse le slug suivre le nom tant que le produit est un brouillon', async () => {
		const cree = await enregistrerProduit(BASE);

		await enregistrerProduit({...BASE, id: cree.id, nom: 'Samouraï du Printemps'});

		const produit = await prisma.product.findUnique({where: {id: cree.id}});
		expect(produit.slug).toBe('samourai-du-printemps');
	});

	it('archive les variantes retirées au lieu de les supprimer', async () => {
		// Une variante est référencée par des lignes de commande passées :
		// l'effacer trouerait l'historique.
		const cree = await enregistrerProduit({
			...BASE,
			variantes: [
				{id: null, nom: 'Standard', sku: 'A-1', prix: '10,00', stock: '1', etat: 'EN_VENTE'},
				{id: null, nom: 'Deluxe', sku: 'A-2', prix: '20,00', stock: '1', etat: 'EN_VENTE'},
			],
		});

		const avant = await prisma.productVariant.findMany({where: {productId: cree.id}});
		const gardee = avant.find((v) => v.name === 'Standard');

		await enregistrerProduit({
			...BASE,
			id: cree.id,
			variantes: [
				{id: gardee.id, nom: 'Standard', sku: 'A-1', prix: '10,00', stock: '1', etat: 'EN_VENTE'},
			],
		});

		const apres = await prisma.productVariant.findMany({where: {productId: cree.id}});
		expect(apres).toHaveLength(2);

		const retiree = apres.find((v) => v.name === 'Deluxe');
		expect(retiree.archivedAt).toBeInstanceOf(Date);
		expect(retiree.isActive).toBe(false);
	});

	it('n’écrit rien quand la saisie est invalide', async () => {
		const resultat = await enregistrerProduit({...BASE, nom: ''});

		expect(resultat.ok).toBe(false);
		expect(await prisma.product.count()).toBe(0);
	});

	it('refuse une image dont l’adresse pointe vers le réseau interne', async () => {
		const resultat = await enregistrerProduit({
			...BASE,
			images: [{url: 'https://169.254.169.254/latest/meta-data/', alt: 'x'}],
		});

		expect(resultat.ok).toBe(false);
		expect(await prisma.product.count()).toBe(0);
	});
});

describe.skipIf(!baseDisponible)('archivage', () => {
	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
	});

	it('retire de la vitrine sans rien effacer', async () => {
		const produit = await creerProduit();

		await archiverProduit(produit.id);

		expect(await listProducts({})).toHaveLength(0);
		expect(await prisma.product.count()).toBe(1);

		const archive = await prisma.product.findUnique({
			where: {id: produit.id},
			include: {variants: true},
		});
		expect(archive.archivedAt).toBeInstanceOf(Date);
		expect(archive.variants[0].isActive).toBe(false);
	});

	it('vide les paniers en cours qui contenaient la pièce', async () => {
		/* Sans ça, le client va au paiement avec un article devenu introuvable et
		   voit sa commande échouer sans comprendre. */
		const produit = await creerProduit();
		await addItem('jeton-a', produit.variants[0].id, 1);

		await archiverProduit(produit.id);

		expect(await prisma.cartItem.count()).toBe(0);
	});

	it('remet en brouillon plutôt qu’en ligne à la restauration', async () => {
		const produit = await creerProduit();
		await archiverProduit(produit.id);

		await restaurerProduit(produit.id);

		const restaure = await prisma.product.findUnique({where: {id: produit.id}});
		expect(restaure.archivedAt).toBeNull();
		expect(restaure.publishedAt).toBeNull();
		expect(await listProducts({})).toHaveLength(0);
	});
});
