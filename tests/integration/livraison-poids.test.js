import {beforeEach, describe, expect, it} from 'vitest';
import {creerCommande, getModeLivraison, getModesLivraisonPour} from '@/server/services/checkout';
import {addItem} from '@/server/services/cart';
import {baseDisponible, creerProduit, ouvrirLaBoutique, prisma, viderLaBase} from './aide';

const adresse = {
	firstName: 'Camille',
	lastName: 'Durand',
	line1: '12 rue des Lilas',
	postalCode: '69003',
	city: 'Lyon',
	email: 'camille@exemple.fr',
};

/* Les frais de port suivent le poids du panier.

   Chaque mode a une tranche (`minWeightGrams` → `maxWeightGrams`, vide = sans
   limite) et n'est proposé que si le poids du panier y tombe. Le test qui
   compte est le dernier : le mode choisi à l'étape livraison est revérifié au
   paiement avec le poids d'alors — un panier alourdi entre-temps ne doit pas
   garder un tarif « petit colis ». */

describe.skipIf(!baseDisponible)('modes de livraison selon le poids', () => {
	let petit;
	let gros;

	beforeEach(async () => {
		await viderLaBase();

		const zone = await prisma.shippingZone.create({
			data: {name: 'France métropolitaine', countries: ['FR']},
		});

		const base = {zoneId: zone.id, carrier: 'La Poste', isActive: true};

		petit = await prisma.shippingRate.create({
			data: {...base, name: 'Petit colis', priceCents: 490, minWeightGrams: 0, maxWeightGrams: 1000},
		});
		gros = await prisma.shippingRate.create({
			data: {...base, name: 'Gros colis', priceCents: 1290, minWeightGrams: 1001, maxWeightGrams: null},
		});
	});

	it('ne propose que le mode dont la tranche couvre le poids', async () => {
		const legerement = await getModesLivraisonPour(2000, 400);
		const lourdement = await getModesLivraisonPour(2000, 5000);

		expect(legerement.map((mode) => mode.nom)).toEqual(['Petit colis']);
		expect(lourdement.map((mode) => mode.nom)).toEqual(['Gros colis']);
	});

	it('inclut les bornes de la tranche', async () => {
		expect((await getModesLivraisonPour(2000, 1000)).map((mode) => mode.nom)).toEqual(['Petit colis']);
		expect((await getModesLivraisonPour(2000, 1001)).map((mode) => mode.nom)).toEqual(['Gros colis']);
	});

	it('sans poids (ouvrage numérique, panier vide), les tranches à partir de 0 restent proposées', async () => {
		expect((await getModesLivraisonPour(2000, 0)).map((mode) => mode.nom)).toEqual(['Petit colis']);
	});

	it('refuse au paiement un mode devenu trop petit pour le panier', async () => {
		expect(await getModeLivraison(petit.id, 2000, 400)).not.toBeNull();
		expect(await getModeLivraison(petit.id, 2000, 5000)).toBeNull();
		expect(await getModeLivraison(gros.id, 2000, 5000)).not.toBeNull();
	});

	it('de bout en bout : la commande refuse un mode trop petit et accepte le bon, port compris', async () => {
		await ouvrirLaBoutique();

		const produit = await creerProduit({prixCents: 2000, stock: 5});
		await prisma.productVariant.update({
			where: {id: produit.variants[0].id},
			data: {weightGrams: 800},
		});

		// 2 × 800 g = 1 600 g : hors de la tranche « petit colis » (≤ 1 000 g).
		await addItem('jeton-poids', produit.variants[0].id, 2);

		const refus = await creerCommande({token: 'jeton-poids', adresse, rateId: petit.id});
		expect(refus.ok).toBe(false);

		const accepte = await creerCommande({token: 'jeton-poids', adresse, rateId: gros.id});
		expect(accepte.ok).toBe(true);

		const commande = await prisma.order.findUnique({where: {id: accepte.id}});
		expect(commande.shippingCents).toBe(1290);
		expect(commande.totalCents).toBe(4000 + 1290);
	});
});
