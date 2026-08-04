import {beforeEach, describe, expect, it} from 'vitest';
import {menageProgramme} from '@/server/services/maintenance';
import {inscrire} from '@/server/services/accounts';
import {creerProduit, ouvrirLaBoutique, prisma, baseDisponible, viderLaBase} from './aide';

/* Ménage programmé.

   Ce qui doit être vérifié n'est pas ce qui est supprimé — c'est ce qui ne l'est
   pas. Une purge trop large fait disparaître le panier d'un client ou la session
   de quelqu'un qui reviendra demain, et personne ne s'en aperçoit avant la
   plainte. */

const JOURS = 24 * 60 * 60 * 1000;

function ilYA(jours) {
	return new Date(Date.now() - jours * JOURS);
}

function dans(jours) {
	return new Date(Date.now() + jours * JOURS);
}

describe.skipIf(!baseDisponible)('ménage programmé', () => {
	let utilisateur;

	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
		await inscrire({email: 'camille@exemple.fr', motDePasse: 'mot-de-passe-initial'});
		utilisateur = await prisma.user.findUnique({where: {email: 'camille@exemple.fr'}});
	});

	it('supprime les jetons périmés de longue date et garde les autres', async () => {
		await prisma.verificationToken.createMany({
			data: [
				{
					userId: utilisateur.id,
					purpose: 'PASSWORD_RESET',
					tokenHash: 'vieux',
					expiresAt: ilYA(60),
				},
				{
					userId: utilisateur.id,
					purpose: 'EMAIL_VERIFY',
					tokenHash: 'expire-hier',
					expiresAt: ilYA(1),
				},
				{
					userId: utilisateur.id,
					purpose: 'PASSWORD_RESET',
					tokenHash: 'en-cours',
					expiresAt: dans(1),
				},
			],
		});

		const rapport = await menageProgramme();

		expect(rapport.detail.jetons).toBe(1);

		const restants = await prisma.verificationToken.findMany({select: {tokenHash: true}});
		expect(restants.map((jeton) => jeton.tokenHash).sort()).toEqual(['en-cours', 'expire-hier']);
	});

	it('supprime les sessions expirées depuis longtemps, garde les sessions valides', async () => {
		await prisma.session.createMany({
			data: [
				{userId: utilisateur.id, token: 'abandonnee', expiresAt: ilYA(30)},
				{userId: utilisateur.id, token: 'expiree-hier', expiresAt: ilYA(1)},
				{userId: utilisateur.id, token: 'ouverte', expiresAt: dans(20)},
			],
		});

		const rapport = await menageProgramme();

		expect(rapport.detail.sessions).toBe(1);

		const restantes = await prisma.session.findMany({select: {token: true}});
		expect(restantes.map((session) => session.token).sort()).toEqual([
			'expiree-hier',
			'ouverte',
		]);
	});

	it('ne touche jamais au panier d’un compte, même très ancien', async () => {
		/* Le défaut le plus coûteux du projet a déjà été celui-là une fois : un
		   panier effacé au mauvais moment. Le panier d'un compte n'expire pas — son
		   propriétaire le retrouve en se connectant, six mois plus tard s'il veut. */
		const produit = await creerProduit();

		await prisma.cart.create({
			data: {
				userId: utilisateur.id,
				expiresAt: ilYA(400),
				items: {create: {variantId: produit.variants[0].id, quantity: 2}},
			},
		});

		const rapport = await menageProgramme();

		expect(rapport.detail.paniers).toBe(0);
		expect(await prisma.cart.count({where: {userId: utilisateur.id}})).toBe(1);
		expect(await prisma.cartItem.count()).toBe(1);
	});

	it('supprime un panier invité oublié, avec ses lignes', async () => {
		const produit = await creerProduit();

		await prisma.cart.create({
			data: {
				sessionToken: 'invite-oublie',
				expiresAt: ilYA(90),
				items: {create: {variantId: produit.variants[0].id, quantity: 1}},
			},
		});

		await prisma.cart.create({
			data: {
				sessionToken: 'invite-recent',
				expiresAt: ilYA(2),
				items: {create: {variantId: produit.variants[0].id, quantity: 1}},
			},
		});

		const rapport = await menageProgramme();

		expect(rapport.detail.paniers).toBe(1);

		const restants = await prisma.cart.findMany({select: {sessionToken: true}});
		expect(restants.map((panier) => panier.sessionToken)).toEqual(['invite-recent']);

		// Les lignes du panier supprimé partent avec lui, sans orphelines.
		expect(await prisma.cartItem.count()).toBe(1);
	});

	it('rend un compte-rendu chiffré et ne lève jamais', async () => {
		const rapport = await menageProgramme();

		expect(rapport.echecs).toEqual([]);
		expect(rapport.total).toBe(0);
		expect(Object.keys(rapport.detail).sort()).toEqual(['jetons', 'paniers', 'sessions']);
	});
});
