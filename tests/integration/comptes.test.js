import {beforeEach, describe, expect, it} from 'vitest';
import {connecter, fusionnerPanier, inscrire} from '@/server/services/accounts';
import {addItem, getCart} from '@/server/services/cart';
import {baseDisponible, creerProduit, ouvrirLaBoutique, prisma, viderLaBase} from './aide';

/* Comptes clients.

   Deux sujets ici. Le premier est une règle de sécurité : le site ne doit
   jamais dire si une adresse est connue. Le second est le défaut qui a coûté le
   plus cher à l'usage — le panier qui disparaissait à la connexion. */

const IDENTIFIANTS = {email: 'Camille@Exemple.FR', motDePasse: 'un-mot-de-passe-long'};

describe.skipIf(!baseDisponible)('inscription', () => {
	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
	});

	it('crée un compte et hache le mot de passe', async () => {
		const resultat = await inscrire(IDENTIFIANTS);

		expect(resultat.ok).toBe(true);
		expect(resultat.cree).toBe(true);

		const utilisateur = await prisma.user.findUnique({where: {email: 'camille@exemple.fr'}});
		expect(utilisateur).not.toBeNull();
		expect(utilisateur.passwordHash).not.toContain('un-mot-de-passe-long');
		expect(utilisateur.passwordHash.startsWith('scrypt$')).toBe(true);
	});

	it('ne révèle pas qu’une adresse est déjà prise', async () => {
		await inscrire(IDENTIFIANTS);
		const seconde = await inscrire({...IDENTIFIANTS, motDePasse: 'autre-mot-de-passe'});

		// Même réponse « ok » que pour une création : le formulaire ne doit pas
		// servir à tester quelles adresses sont clientes.
		expect(seconde.ok).toBe(true);
		expect(seconde.cree).toBe(false);

		// Et surtout, le compte existant n'a pas été écrasé.
		expect(await prisma.user.count()).toBe(1);
		expect((await connecter(IDENTIFIANTS)).ok).toBe(true);
	});

	it('refuse un mot de passe trop court', async () => {
		const resultat = await inscrire({...IDENTIFIANTS, motDePasse: 'court'});

		expect(resultat.ok).toBe(false);
		expect(await prisma.user.count()).toBe(0);
	});

	it('refuse une adresse qui n’en est pas une', async () => {
		expect((await inscrire({...IDENTIFIANTS, email: 'camille'})).ok).toBe(false);
	});

	it('horodate le consentement marketing au lieu de le cocher', async () => {
		await inscrire({...IDENTIFIANTS, optInNewsletter: true});

		const utilisateur = await prisma.user.findUnique({where: {email: 'camille@exemple.fr'}});
		// Le RGPD demande de pouvoir prouver quand le consentement a été donné.
		expect(utilisateur.marketingOptIn).toBeInstanceOf(Date);
	});
});

describe.skipIf(!baseDisponible)('connexion', () => {
	beforeEach(async () => {
		await viderLaBase();
		await inscrire(IDENTIFIANTS);
	});

	it('accepte les bons identifiants, quelle que soit la casse de l’adresse', async () => {
		expect((await connecter({...IDENTIFIANTS, email: 'CAMILLE@exemple.fr'})).ok).toBe(true);
	});

	it('renvoie le même message pour un compte inconnu et un mot de passe faux', async () => {
		const inconnu = await connecter({email: 'personne@ailleurs.fr', motDePasse: 'peu importe'});
		const faux = await connecter({...IDENTIFIANTS, motDePasse: 'mauvais-mot-de-passe'});

		expect(inconnu.ok).toBe(false);
		expect(faux.ok).toBe(false);
		expect(inconnu.erreur).toBe(faux.erreur);
	});

	it('refuse un compte anonymisé', async () => {
		await prisma.user.update({
			where: {email: 'camille@exemple.fr'},
			data: {anonymizedAt: new Date()},
		});

		expect((await connecter(IDENTIFIANTS)).ok).toBe(false);
	});

	it('note la date de dernière connexion', async () => {
		await connecter(IDENTIFIANTS);

		const utilisateur = await prisma.user.findUnique({where: {email: 'camille@exemple.fr'}});
		expect(utilisateur.lastLoginAt).toBeInstanceOf(Date);
	});
});

describe.skipIf(!baseDisponible)('fusion du panier à la connexion', () => {
	let utilisateur;
	let produit;

	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();

		await inscrire(IDENTIFIANTS);
		utilisateur = await prisma.user.findUnique({where: {email: 'camille@exemple.fr'}});
		produit = await creerProduit({stock: 20});
	});

	it('garde le panier visible après la connexion', async () => {
		/* Le défaut qui a motivé ce test : la fusion effaçait le jeton de session,
		   alors que tout le site retrouve le panier par lui. Le client voyait son
		   panier se vider au moment le plus coûteux — juste avant de payer. */
		await addItem('jeton-a', produit.variants[0].id, 2);

		await fusionnerPanier('jeton-a', utilisateur.id);

		const panier = await getCart('jeton-a');
		expect(panier.nombreArticles).toBe(2);
	});

	it('rattache le panier invité au compte', async () => {
		await addItem('jeton-a', produit.variants[0].id, 1);

		await fusionnerPanier('jeton-a', utilisateur.id);

		const panier = await prisma.cart.findFirst({where: {userId: utilisateur.id}});
		expect(panier).not.toBeNull();
		expect(panier.sessionToken).toBe('jeton-a');
	});

	it('additionne les quantités quand les deux paniers ont la même pièce', async () => {
		// Panier du compte, laissé lors d'une visite précédente.
		const ancien = await prisma.cart.create({
			data: {userId: utilisateur.id, expiresAt: new Date(Date.now() + 86_400_000)},
		});
		await prisma.cartItem.create({
			data: {cartId: ancien.id, variantId: produit.variants[0].id, quantity: 1},
		});

		// Panier d'aujourd'hui, avant connexion.
		await addItem('jeton-a', produit.variants[0].id, 2);

		await fusionnerPanier('jeton-a', utilisateur.id);

		const panier = await getCart('jeton-a');
		expect(panier.nombreArticles).toBe(3);
		expect(await prisma.cart.count()).toBe(1);
	});

	it('ne laisse jamais deux paniers pour un même compte', async () => {
		const ancien = await prisma.cart.create({
			data: {userId: utilisateur.id, expiresAt: new Date(Date.now() + 86_400_000)},
		});
		await prisma.cartItem.create({
			data: {cartId: ancien.id, variantId: produit.variants[0].id, quantity: 1},
		});
		await addItem('jeton-a', produit.variants[0].id, 1);

		await fusionnerPanier('jeton-a', utilisateur.id);

		expect(await prisma.cart.count({where: {userId: utilisateur.id}})).toBe(1);
	});

	it('ne fait rien sans jeton ni panier invité', async () => {
		await expect(fusionnerPanier(null, utilisateur.id)).resolves.toBeUndefined();
		await expect(fusionnerPanier('jeton-jamais-vu', utilisateur.id)).resolves.toBeUndefined();
	});
});
