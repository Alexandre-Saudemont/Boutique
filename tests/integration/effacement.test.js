import {beforeEach, describe, expect, it} from 'vitest';
import {anonymiserCompte, connecter, inscrire} from '@/server/services/accounts';
import {creerJeton} from '@/server/auth/tokens';
import {addItem} from '@/server/services/cart';
import {creerCommande} from '@/server/services/checkout';
import {
	baseDisponible,
	creerModeLivraison,
	creerProduit,
	ouvrirLaBoutique,
	prisma,
	viderLaBase,
} from './aide';

/* Droit à l'effacement.

   L'équilibre à tenir : effacer tout ce qui identifie la personne, garder ce
   que la loi comptable oblige à conserver. Ces tests décrivent la frontière
   exacte entre les deux. */

const IDENTIFIANTS = {email: 'camille@exemple.fr', motDePasse: 'un-mot-de-passe-long'};

describe.skipIf(!baseDisponible)('anonymisation d’un compte', () => {
	let utilisateur;

	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
		await inscrire({...IDENTIFIANTS, prenom: 'Camille', optInNewsletter: true});
		utilisateur = await prisma.user.findUnique({where: {email: IDENTIFIANTS.email}});
	});

	it('exige le mot de passe', async () => {
		const resultat = await anonymiserCompte(utilisateur.id, 'mauvais-mot-de-passe');

		expect(resultat.ok).toBe(false);

		const apres = await prisma.user.findUnique({where: {id: utilisateur.id}});
		expect(apres.anonymizedAt).toBeNull();
		expect(apres.email).toBe(IDENTIFIANTS.email);
	});

	it('efface l’identité et interdit toute reconnexion', async () => {
		expect((await anonymiserCompte(utilisateur.id, IDENTIFIANTS.motDePasse)).ok).toBe(true);

		const apres = await prisma.user.findUnique({where: {id: utilisateur.id}});

		expect(apres.email).not.toBe(IDENTIFIANTS.email);
		expect(apres.email).toContain('@supprime.invalid');
		expect(apres.firstName).toBeNull();
		expect(apres.phone).toBeNull();
		expect(apres.passwordHash).toBeNull();
		expect(apres.marketingOptIn).toBeNull();
		expect(apres.anonymizedAt).toBeInstanceOf(Date);

		expect((await connecter(IDENTIFIANTS)).ok).toBe(false);
	});

	it('ferme les sessions et les jetons en cours', async () => {
		await prisma.session.create({
			data: {
				userId: utilisateur.id,
				token: 'session-1',
				expiresAt: new Date(Date.now() + 86_400_000),
			},
		});
		await creerJeton(utilisateur.id, 'PASSWORD_RESET');

		await anonymiserCompte(utilisateur.id, IDENTIFIANTS.motDePasse);

		expect(await prisma.session.count({where: {userId: utilisateur.id}})).toBe(0);
		expect(await prisma.verificationToken.count({where: {userId: utilisateur.id}})).toBe(0);
	});

	it('désinscrit l’adresse de la lettre', async () => {
		await prisma.newsletterSubscriber.create({
			data: {email: IDENTIFIANTS.email, token: 'jeton-lettre', confirmedAt: new Date()},
		});

		await anonymiserCompte(utilisateur.id, IDENTIFIANTS.motDePasse);

		const abonne = await prisma.newsletterSubscriber.findUnique({
			where: {email: IDENTIFIANTS.email},
		});
		expect(abonne.unsubscribedAt).toBeInstanceOf(Date);
	});

	it('conserve les commandes : ce sont des pièces comptables', async () => {
		/* La limite du droit à l'effacement : une facture émise doit rester
		   lisible dix ans. Le compte disparaît, la commande reste. */
		const mode = await creerModeLivraison();
		const produit = await creerProduit();
		await addItem('jeton-a', produit.variants[0].id, 1);
		const commande = await creerCommande({
			token: 'jeton-a',
			adresse: {
				firstName: 'Camille',
				lastName: 'Durand',
				line1: '12 rue des Lilas',
				postalCode: '69003',
				city: 'Lyon',
				email: IDENTIFIANTS.email,
			},
			rateId: mode.id,
		});

		await anonymiserCompte(utilisateur.id, IDENTIFIANTS.motDePasse);

		const conservee = await prisma.order.findUnique({
			where: {id: commande.id},
			include: {addresses: true, items: true},
		});

		expect(conservee).not.toBeNull();
		expect(conservee.totalCents).toBeGreaterThan(0);
		expect(conservee.addresses).toHaveLength(1);
	});

	it('supprime les droits de téléchargement, y compris ceux d’un achat invité', async () => {
		/* Deux choses à la fois : une adresse e-mail en clair qui survivrait à
		   l'effacement, et des liens envoyés qui continueraient de fonctionner
		   pour un compte qui n'existe plus. La commande, elle, reste. */
		const produit = await prisma.product.create({
			data: {
				name: 'Carnet',
				slug: 'carnet-effacement',
				kind: 'DIGITAL',
				digitalAssets: {
					create: {
						fileKey: 'cle-de-test',
						fileName: 'carnet.pdf',
						mimeType: 'application/pdf',
						sizeBytes: 10,
					},
				},
			},
			include: {digitalAssets: true},
		});

		const commande = await prisma.order.create({
			data: {
				orderNumber: 'AVGF-2026-000500',
				// Achat fait en invité : rattaché par l'adresse seulement.
				email: IDENTIFIANTS.email,
				status: 'PAID',
				subtotalCents: 900,
				totalCents: 900,
				items: {
					create: {
						productName: 'Carnet',
						variantName: 'Standard',
						sku: 'NUM-1',
						kind: 'DIGITAL',
						unitPriceCents: 900,
						quantity: 1,
						totalCents: 900,
					},
				},
			},
			include: {items: true},
		});

		await prisma.downloadGrant.create({
			data: {
				digitalAssetId: produit.digitalAssets[0].id,
				orderItemId: commande.items[0].id,
				email: IDENTIFIANTS.email,
				token: 'jeton-de-test',
			},
		});

		await anonymiserCompte(utilisateur.id, IDENTIFIANTS.motDePasse);

		expect(await prisma.downloadGrant.count()).toBe(0);
		expect(await prisma.order.count({where: {id: commande.id}})).toBe(1);
	});

	it('détache les avis et retire le nom affiché', async () => {
		const produit = await creerProduit();
		await prisma.review.create({
			data: {
				productId: produit.id,
				userId: utilisateur.id,
				authorName: 'Camille',
				rating: 5,
				content: 'Superbe pièce.',
				status: 'APPROVED',
			},
		});

		await anonymiserCompte(utilisateur.id, IDENTIFIANTS.motDePasse);

		const avis = await prisma.review.findFirst();
		expect(avis.userId).toBeNull();
		expect(avis.authorName).not.toBe('Camille');
		// Le texte reste : il informe les autres acheteurs et n'identifie personne.
		expect(avis.content).toBe('Superbe pièce.');
	});

	it('supprime le panier et les adresses enregistrées', async () => {
		const produit = await creerProduit();
		await addItem('jeton-a', produit.variants[0].id, 1);
		await prisma.cart.updateMany({where: {sessionToken: 'jeton-a'}, data: {userId: utilisateur.id}});
		await prisma.address.create({
			data: {
				userId: utilisateur.id,
				type: 'SHIPPING',
				firstName: 'Camille',
				lastName: 'Durand',
				line1: '12 rue des Lilas',
				postalCode: '69003',
				city: 'Lyon',
				country: 'FR',
			},
		});

		await anonymiserCompte(utilisateur.id, IDENTIFIANTS.motDePasse);

		expect(await prisma.cart.count({where: {userId: utilisateur.id}})).toBe(0);
		expect(await prisma.address.count({where: {userId: utilisateur.id}})).toBe(0);
	});

	it('laisse coexister deux comptes anonymisés', async () => {
		// L'adresse est unique en base : deux comptes effacés ne doivent pas se
		// heurter sur une valeur vide commune.
		await inscrire({email: 'autre@exemple.fr', motDePasse: 'un-mot-de-passe-long'});
		const second = await prisma.user.findUnique({where: {email: 'autre@exemple.fr'}});

		await anonymiserCompte(utilisateur.id, IDENTIFIANTS.motDePasse);
		const resultat = await anonymiserCompte(second.id, 'un-mot-de-passe-long');

		expect(resultat.ok).toBe(true);
	});

	it('refuse d’anonymiser deux fois', async () => {
		await anonymiserCompte(utilisateur.id, IDENTIFIANTS.motDePasse);

		expect((await anonymiserCompte(utilisateur.id, IDENTIFIANTS.motDePasse)).ok).toBe(false);
	});
});
