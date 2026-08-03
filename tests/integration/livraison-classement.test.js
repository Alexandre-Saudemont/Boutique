import {beforeEach, describe, expect, it} from 'vitest';
import {
	basculerTarif,
	enregistrerTarif,
	enregistrerZone,
	getModesLivraison,
	listerZones,
} from '@/server/services/shipping';
import {basculer, enregistrer, lister, typeConnu} from '@/server/services/taxonomies';
import {getModesLivraisonPour} from '@/server/services/checkout';
import {baseDisponible, prisma, viderLaBase} from './aide';

/* Livraison et classement, gérés depuis le back-office.

   Ce que ces tests protègent : ce que le client saisit dans l'administration
   est exactement ce que verra l'acheteur au moment de choisir son envoi. Un
   écart entre les deux se paie en commandes mal facturées. */

describe.skipIf(!baseDisponible)('zones et modes de livraison', () => {
	let zone;

	beforeEach(async () => {
		await viderLaBase();
		const resultat = await enregistrerZone({nom: 'France', pays: 'fr, be'});
		zone = resultat.id;
	});

	it('normalise les codes pays en majuscules', async () => {
		const [enBase] = await listerZones();

		expect(enBase.countries).toEqual(['FR', 'BE']);
	});

	it('refuse une zone sans pays exploitable', async () => {
		const resultat = await enregistrerZone({nom: 'Nulle part', pays: 'France, Belgique'});

		expect(resultat.ok).toBe(false);
		expect(resultat.erreurs.pays).toBeTruthy();
	});

	it('enregistre un mode et le propose aussitôt au client', async () => {
		const resultat = await enregistrerTarif({
			zoneId: zone,
			nom: 'Colissimo à domicile',
			transporteur: 'La Poste',
			prix: '5,90',
			franco: '50,00',
			delai: '2 à 3 jours',
			actif: true,
		});

		expect(resultat.ok).toBe(true);

		const [mode] = await getModesLivraison();
		expect(mode.name).toBe('Colissimo à domicile');
		expect(mode.priceCents).toBe(590);
		expect(mode.freeAboveCents).toBe(5000);
	});

	it('distingue « pas de franco » de « toujours offerte »', async () => {
		/* Le champ vide veut dire « jamais offerte », un zéro voudrait dire
		   « toujours offerte ». Les confondre offrirait la livraison sur tout. */
		await enregistrerTarif({
			zoneId: zone,
			nom: 'Sans franco',
			transporteur: 'X',
			prix: '4,00',
			franco: '',
			actif: true,
		});

		const [mode] = await getModesLivraison();
		expect(mode.freeAboveCents).toBeNull();
	});

	it('applique le franco saisi au panier du client', async () => {
		await enregistrerTarif({
			zoneId: zone,
			nom: 'Colissimo',
			transporteur: 'La Poste',
			prix: '5,90',
			franco: '50,00',
			actif: true,
		});

		const sousLeSeuil = await getModesLivraisonPour(4999);
		const auSeuil = await getModesLivraisonPour(5000);

		expect(sousLeSeuil[0].prixCents).toBe(590);
		expect(sousLeSeuil[0].offert).toBe(false);
		expect(auSeuil[0].prixCents).toBe(0);
		expect(auSeuil[0].offert).toBe(true);
	});

	it('refuse un prix ou un franco illisible', async () => {
		const prix = await enregistrerTarif({
			zoneId: zone,
			nom: 'X',
			transporteur: 'Y',
			prix: 'gratuit',
			actif: true,
		});
		const franco = await enregistrerTarif({
			zoneId: zone,
			nom: 'X',
			transporteur: 'Y',
			prix: '5,00',
			franco: 'cinquante',
			actif: true,
		});

		expect(prix.ok).toBe(false);
		expect(franco.ok).toBe(false);
		expect(await prisma.shippingRate.count()).toBe(0);
	});

	it('retire un mode désactivé du tunnel sans le supprimer', async () => {
		const {id} = await enregistrerTarif({
			zoneId: zone,
			nom: 'Retrait à l’atelier',
			transporteur: 'Sur place',
			prix: '0',
			actif: true,
		});

		await basculerTarif(id, false);

		expect(await getModesLivraison()).toHaveLength(0);
		// Des commandes passées portent son nom : il doit rester en base.
		expect(await prisma.shippingRate.count()).toBe(1);
	});

	it('masque aussi les modes d’une zone désactivée', async () => {
		await enregistrerTarif({
			zoneId: zone,
			nom: 'Colissimo',
			transporteur: 'La Poste',
			prix: '5,90',
			actif: true,
		});

		await enregistrerZone({id: zone, nom: 'France', pays: 'FR', actif: false});

		expect(await getModesLivraison()).toHaveLength(0);
	});
});

describe.skipIf(!baseDisponible)('rayons, marques et licences', () => {
	beforeEach(async () => {
		await viderLaBase();
	});

	it('crée une entrée avec un slug dérivé du nom', async () => {
		await enregistrer('rayon', {nom: 'Figurines & statuettes'});

		const [rayon] = await lister('rayon');
		expect(rayon.slug).toBe('figurines-statuettes');
	});

	it('fige le slug quand on renomme — il est dans les liens partagés', async () => {
		const {id} = await enregistrer('rayon', {nom: 'Figurines'});

		await enregistrer('rayon', {id, nom: 'Figurines et statuettes'});

		const [rayon] = await lister('rayon');
		expect(rayon.nom).toBe('Figurines et statuettes');
		expect(rayon.slug).toBe('figurines');
	});

	it('rend les slugs uniques au sein d’un type', async () => {
		await enregistrer('marque', {nom: 'Bandai'});
		await enregistrer('marque', {nom: 'Bandai'});

		const slugs = (await lister('marque')).map((entree) => entree.slug);
		expect(new Set(slugs).size).toBe(2);
	});

	it('n’écrit jamais dans la mauvaise table', async () => {
		await enregistrer('marque', {nom: 'Bandai'});

		expect(await lister('rayon')).toHaveLength(0);
		expect(await lister('licence')).toHaveLength(0);
		expect(await lister('marque')).toHaveLength(1);
	});

	it('refuse un type inventé', async () => {
		expect(typeConnu('rayon')).toBe(true);
		expect(typeConnu('utilisateurs')).toBe(false);
		expect(typeConnu('')).toBe(false);

		await expect(enregistrer('utilisateurs', {nom: 'X'})).resolves.toEqual({
			ok: false,
			erreurs: {nom: 'Type inconnu.'},
		});
	});

	it('refuse un nom vide', async () => {
		expect((await enregistrer('rayon', {nom: '   '})).ok).toBe(false);
		expect(await lister('rayon')).toHaveLength(0);
	});

	it('compte les produits rattachés — de quoi décider avant de masquer', async () => {
		const {id} = await enregistrer('rayon', {nom: 'Figurines'});
		await prisma.product.create({
			data: {name: 'Rônin', slug: 'ronin', primaryCategoryId: id},
		});

		const [rayon] = await lister('rayon');
		expect(rayon.produits).toBe(1);
	});

	it('masque sans détacher les produits', async () => {
		const {id} = await enregistrer('rayon', {nom: 'Figurines'});
		await prisma.product.create({
			data: {name: 'Rônin', slug: 'ronin', primaryCategoryId: id},
		});

		await basculer('rayon', id, false);

		const [rayon] = await lister('rayon');
		expect(rayon.actif).toBe(false);
		expect(rayon.produits).toBe(1);
	});
});
