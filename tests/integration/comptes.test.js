import {beforeEach, describe, expect, it} from 'vitest';
import {
	changerMotDePasse,
	connecter,
	demanderReinitialisation,
	fusionnerPanier,
	inscrire,
} from '@/server/services/accounts';
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

/* Changement de mot de passe depuis son compte.

   Le garde-fou central est la fermeture des autres sessions : quelqu'un qui
   change son mot de passe soupçonne souvent quelque chose, et laisser ouverte
   la session d'un intrus rendrait le geste inutile. Sa propre session, elle,
   doit survivre — le déconnecter au moment où il vient de prouver son identité
   deux fois ferait croire à un échec. */
describe.skipIf(!baseDisponible)('changement de mot de passe', () => {
	const NOUVEAU = 'un-autre-mot-de-passe-long';
	let utilisateur;

	beforeEach(async () => {
		await viderLaBase();
		await inscrire(IDENTIFIANTS);
		utilisateur = await prisma.user.findUnique({where: {email: 'camille@exemple.fr'}});
	});

	async function creerSessionEnBase(token) {
		return prisma.session.create({
			data: {
				userId: utilisateur.id,
				token,
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			},
		});
	}

	it('change le mot de passe quand l’ancien est bon', async () => {
		const resultat = await changerMotDePasse(utilisateur.id, {
			actuel: IDENTIFIANTS.motDePasse,
			nouveau: NOUVEAU,
		});

		expect(resultat.ok).toBe(true);
		expect((await connecter({...IDENTIFIANTS, motDePasse: NOUVEAU})).ok).toBe(true);
		expect((await connecter(IDENTIFIANTS)).ok).toBe(false);
	});

	it('refuse si le mot de passe actuel est faux, et ne change rien', async () => {
		const resultat = await changerMotDePasse(utilisateur.id, {
			actuel: 'ce-n-est-pas-le-bon',
			nouveau: NOUVEAU,
		});

		expect(resultat.ok).toBe(false);
		// L'ancien fonctionne toujours : rien n'a été écrit.
		expect((await connecter(IDENTIFIANTS)).ok).toBe(true);
	});

	it('refuse un nouveau mot de passe trop court', async () => {
		const resultat = await changerMotDePasse(utilisateur.id, {
			actuel: IDENTIFIANTS.motDePasse,
			nouveau: 'court',
		});

		expect(resultat.ok).toBe(false);
		expect((await connecter(IDENTIFIANTS)).ok).toBe(true);
	});

	it('refuse de remplacer un mot de passe par lui-même', async () => {
		const resultat = await changerMotDePasse(utilisateur.id, {
			actuel: IDENTIFIANTS.motDePasse,
			nouveau: IDENTIFIANTS.motDePasse,
		});

		expect(resultat.ok).toBe(false);
	});

	/* Le cœur du sujet. Sans cette fermeture, changer son mot de passe après une
	   compromission ne déloge personne. */
	it('ferme les autres sessions et garde celle qui a fait la demande', async () => {
		await creerSessionEnBase('jeton-de-la-personne');
		await creerSessionEnBase('jeton-de-l-intrus');
		await creerSessionEnBase('jeton-d-un-vieux-telephone');

		await changerMotDePasse(utilisateur.id, {
			actuel: IDENTIFIANTS.motDePasse,
			nouveau: NOUVEAU,
			jetonAConserver: 'jeton-de-la-personne',
		});

		const restantes = await prisma.session.findMany({where: {userId: utilisateur.id}});

		expect(restantes.map((session) => session.token)).toEqual(['jeton-de-la-personne']);
	});

	it('ferme tout quand aucune session n’est à conserver', async () => {
		await creerSessionEnBase('jeton-quelconque');

		await changerMotDePasse(utilisateur.id, {
			actuel: IDENTIFIANTS.motDePasse,
			nouveau: NOUVEAU,
		});

		expect(await prisma.session.count({where: {userId: utilisateur.id}})).toBe(0);
	});

	/* Un lien de réinitialisation oublié dans une boîte mail ne doit pas
	   permettre de revenir en arrière une fois le mot de passe changé. */
	it('brûle les jetons de réinitialisation en cours', async () => {
		await demanderReinitialisation(IDENTIFIANTS.email);

		expect(
			await prisma.verificationToken.count({
				where: {userId: utilisateur.id, purpose: 'PASSWORD_RESET'},
			}),
		).toBe(1);

		await changerMotDePasse(utilisateur.id, {
			actuel: IDENTIFIANTS.motDePasse,
			nouveau: NOUVEAU,
		});

		expect(
			await prisma.verificationToken.count({
				where: {userId: utilisateur.id, purpose: 'PASSWORD_RESET'},
			}),
		).toBe(0);
	});

	/* Un compte converti depuis une commande en invité n'a pas d'empreinte : il
	   n'y a pas d'« ancien » à vérifier, et l'accepter laisserait n'importe
	   quelle session poser un mot de passe dessus. */
	it('refuse un compte sans mot de passe, et renvoie vers « oublié »', async () => {
		await prisma.user.update({where: {id: utilisateur.id}, data: {passwordHash: null}});

		const resultat = await changerMotDePasse(utilisateur.id, {
			actuel: '',
			nouveau: NOUVEAU,
		});

		expect(resultat.ok).toBe(false);
		expect(resultat.erreur).toContain('oublié');
	});

	it('refuse un compte anonymisé', async () => {
		await prisma.user.update({
			where: {id: utilisateur.id},
			data: {anonymizedAt: new Date()},
		});

		const resultat = await changerMotDePasse(utilisateur.id, {
			actuel: IDENTIFIANTS.motDePasse,
			nouveau: NOUVEAU,
		});

		expect(resultat.ok).toBe(false);
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
