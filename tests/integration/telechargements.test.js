import {afterAll, beforeEach, describe, expect, it} from 'vitest';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {
	consommerTelechargement,
	delivrerTelechargements,
	enregistrerFichier,
	getFichierDuCompte,
	getTelechargementsDuCompte,
	lireDroitParJeton,
	supprimerFichier,
} from '@/server/services/digital';
import {creerCommande} from '@/server/services/checkout';
import {addItem} from '@/server/services/cart';
import {
	baseDisponible,
	creerModeLivraison,
	creerProduit,
	ouvrirLaBoutique,
	prisma,
	viderLaBase,
} from './aide';

/* Ouvrages numériques.

   Ce qui est vérifié ici est ce qui coûte cher à rater : un lien qui donne
   accès sans limite, un lien qui donne accès au fichier de quelqu'un d'autre, et
   à l'inverse un client qui a payé et ne peut plus rien télécharger. */

const FICHIER = Buffer.from('%PDF-1.4 contenu de test');

let dossier;

async function creerOuvrage({nom = 'Carnet du vieux geek'} = {}) {
	const produit = await prisma.product.create({
		data: {
			name: nom,
			slug: `ouvrage-${Math.random().toString(36).slice(2, 10)}`,
			kind: 'DIGITAL',
			isActive: true,
			publishedAt: new Date('2026-01-01'),
			variants: {
				create: {
					sku: `SKU-NUM-${Math.random().toString(36).slice(2, 8)}`,
					name: 'Standard',
					priceCents: 1200,
					stock: 0,
				},
			},
		},
		include: {variants: true},
	});

	const {asset} = await enregistrerFichier({
		productId: produit.id,
		fileName: 'carnet.pdf',
		mimeType: 'application/pdf',
		contenu: FICHIER,
	});

	return {produit, variante: produit.variants[0], asset};
}

async function creerCommandePayee({variante, email = 'camille@exemple.fr', userId = null}) {
	return prisma.order.create({
		data: {
			orderNumber: `AVGF-2026-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
			email,
			userId,
			status: 'PAID',
			subtotalCents: 1200,
			totalCents: 1200,
			paidAt: new Date(),
			items: {
				create: {
					variantId: variante.id,
					productName: 'Carnet du vieux geek',
					variantName: 'Standard',
					sku: variante.sku,
					kind: 'DIGITAL',
					unitPriceCents: 1200,
					quantity: 1,
					totalCents: 1200,
				},
			},
		},
	});
}

describe.skipIf(!baseDisponible)('ouvrages numériques', () => {
	beforeEach(async () => {
		await viderLaBase();

		/* Les fichiers de test vont dans un dossier temporaire : rien n'est écrit
		   dans le stockage réel, et il n'y a rien à nettoyer si un test échoue en
		   plein milieu. */
		dossier = await mkdtemp(path.join(tmpdir(), 'antre-numerique-'));
		process.env.DIGITAL_STORAGE_DIR = dossier;
	});

	afterAll(async () => {
		delete process.env.DIGITAL_STORAGE_DIR;
		if (dossier) await rm(dossier, {recursive: true, force: true});
	});

	it('ne range jamais le fichier sous son nom d’origine', async () => {
		/* Deux clients qui envoient `couverture.pdf` s'écraseraient, et un nom
		   saisi ailleurs pourrait sortir du dossier. */
		const {asset} = await creerOuvrage();

		expect(asset.fileKey).not.toContain('carnet');
		expect(asset.fileKey).toMatch(/^[0-9a-f]{32}$/);
		expect(asset.fileName).toBe('carnet.pdf');
	});

	it('refuse un fichier sur un produit physique', async () => {
		const produit = await prisma.product.create({
			data: {name: 'Figurine', slug: 'figurine-physique', kind: 'PHYSICAL'},
		});

		const resultat = await enregistrerFichier({
			productId: produit.id,
			fileName: 'x.pdf',
			mimeType: 'application/pdf',
			contenu: FICHIER,
		});

		expect(resultat.ok).toBe(false);
	});

	it('refuse un type de fichier inattendu', async () => {
		const {produit} = await creerOuvrage();

		const resultat = await enregistrerFichier({
			productId: produit.id,
			fileName: 'script.sh',
			mimeType: 'application/x-sh',
			contenu: FICHIER,
		});

		expect(resultat.ok).toBe(false);
	});

	it('ne stocke jamais le jeton en clair', async () => {
		/* Le scénario redouté : une copie de la base fuite. Si les jetons y sont en
		   clair, chaque ouvrage vendu devient téléchargeable. */
		const {variante} = await creerOuvrage();
		const commande = await creerCommandePayee({variante});

		const {liens} = await delivrerTelechargements(commande.id);

		expect(liens).toHaveLength(1);

		const enregistre = await prisma.downloadGrant.findFirst();
		expect(enregistre.token).not.toBe(liens[0].jeton);
		expect(enregistre.token).toMatch(/^[0-9a-f]{64}$/);
	});

	it('ne délivre pas deux fois les mêmes droits', async () => {
		// Stripe rejoue ses événements : un second passage ne doit pas produire un
		// second jeu de liens valables.
		const {variante} = await creerOuvrage();
		const commande = await creerCommandePayee({variante});

		const premier = await delivrerTelechargements(commande.id);
		const second = await delivrerTelechargements(commande.id);

		expect(premier.liens).toHaveLength(1);
		expect(second.liens).toHaveLength(0);
		expect(await prisma.downloadGrant.count()).toBe(1);
	});

	it('ne délivre rien pour une commande sans ouvrage numérique', async () => {
		const produit = await prisma.product.create({
			data: {
				name: 'Figurine',
				slug: 'figurine-simple',
				kind: 'PHYSICAL',
				variants: {create: {sku: 'SKU-PHY-1', name: 'Standard', priceCents: 500, stock: 3}},
			},
			include: {variants: true},
		});

		const commande = await prisma.order.create({
			data: {
				orderNumber: 'AVGF-2026-000900',
				email: 'camille@exemple.fr',
				status: 'PAID',
				subtotalCents: 500,
				totalCents: 500,
				items: {
					create: {
						variantId: produit.variants[0].id,
						productName: 'Figurine',
						variantName: 'Standard',
						sku: 'SKU-PHY-1',
						kind: 'PHYSICAL',
						unitPriceCents: 500,
						quantity: 1,
						totalCents: 500,
					},
				},
			},
		});

		const {liens} = await delivrerTelechargements(commande.id);
		expect(liens).toHaveLength(0);
	});

	it('lire le lien ne consomme aucun téléchargement', async () => {
		/* Les clients de messagerie préchargent les liens : ouvrir la page ne doit
		   jamais coûter un essai au client. */
		const {variante} = await creerOuvrage();
		const commande = await creerCommandePayee({variante});
		const {liens} = await delivrerTelechargements(commande.id);

		await lireDroitParJeton(liens[0].jeton);
		await lireDroitParJeton(liens[0].jeton);
		await lireDroitParJeton(liens[0].jeton);

		const droit = await lireDroitParJeton(liens[0].jeton);
		expect(droit.restants).toBe(5);
		expect(droit.utilisable).toBe(true);
	});

	it('s’épuise après cinq téléchargements et pas avant', async () => {
		const {variante} = await creerOuvrage();
		const commande = await creerCommandePayee({variante});
		const {liens} = await delivrerTelechargements(commande.id);

		for (let essai = 0; essai < 5; essai += 1) {
			expect(await consommerTelechargement(liens[0].jeton)).not.toBeNull();
		}

		expect(await consommerTelechargement(liens[0].jeton)).toBeNull();

		const droit = await lireDroitParJeton(liens[0].jeton);
		expect(droit.utilisable).toBe(false);
		expect(droit.motif).toBe('EPUISE');
	});

	it('refuse un lien expiré, même s’il reste des téléchargements', async () => {
		const {variante} = await creerOuvrage();
		const commande = await creerCommandePayee({variante});
		const {liens} = await delivrerTelechargements(commande.id);

		await prisma.downloadGrant.updateMany({data: {expiresAt: new Date('2020-01-01')}});

		expect(await consommerTelechargement(liens[0].jeton)).toBeNull();
		expect((await lireDroitParJeton(liens[0].jeton)).motif).toBe('EXPIRE');
	});

	it('refuse un jeton inconnu, vide ou d’un autre format', async () => {
		expect(await lireDroitParJeton('inconnu')).toBeNull();
		expect(await lireDroitParJeton('')).toBeNull();
		expect(await lireDroitParJeton(null)).toBeNull();
		expect(await consommerTelechargement('inconnu')).toBeNull();
	});

	it('donne au compte un accès sans limite, jeton épuisé ou non', async () => {
		/* C'est la promesse faite au client (question 9) : le lien est borné,
		   l'accès depuis le compte ne l'est pas. */
		const {variante, asset} = await creerOuvrage();
		const utilisateur = await prisma.user.create({
			data: {email: 'camille@exemple.fr', passwordHash: 'x'},
		});
		const commande = await creerCommandePayee({variante, userId: utilisateur.id});
		const {liens} = await delivrerTelechargements(commande.id);

		for (let essai = 0; essai < 5; essai += 1) await consommerTelechargement(liens[0].jeton);

		const fichiers = await getTelechargementsDuCompte(utilisateur);
		expect(fichiers).toHaveLength(1);
		expect(fichiers[0].digitalAsset.id).toBe(asset.id);

		const servi = await getFichierDuCompte(fichiers[0].id, utilisateur);
		expect(servi.id).toBe(asset.id);
	});

	it('retrouve les achats faits en invité une fois l’adresse vérifiée', async () => {
		const {variante} = await creerOuvrage();
		const commande = await creerCommandePayee({variante, email: 'camille@exemple.fr'});
		await delivrerTelechargements(commande.id);

		const utilisateur = await prisma.user.create({
			data: {
				email: 'camille@exemple.fr',
				passwordHash: 'x',
				emailVerifiedAt: new Date(),
			},
		});

		expect(await getTelechargementsDuCompte(utilisateur)).toHaveLength(1);
	});

	it('ne donne rien à un compte dont l’adresse n’est pas vérifiée', async () => {
		/* Le scénario redouté : quelqu'un crée un compte sur l'adresse d'un client
		   qui a commandé en invité, et récupère ses achats. Créer un compte ne
		   prouve rien sur l'adresse saisie — c'est le lien de vérification qui le
		   prouve, et lui seul ouvre ce rattachement. */
		const {variante} = await creerOuvrage();
		const commande = await creerCommandePayee({variante, email: 'camille@exemple.fr'});
		await delivrerTelechargements(commande.id);

		const usurpateur = await prisma.user.create({
			data: {email: 'camille@exemple.fr', passwordHash: 'x'},
		});

		expect(await getTelechargementsDuCompte(usurpateur)).toHaveLength(0);

		const droit = await prisma.downloadGrant.findFirst();
		expect(await getFichierDuCompte(droit.id, usurpateur)).toBeNull();
	});

	it('ne donne pas le fichier d’un autre compte', async () => {
		/* Deviner un identifiant de droit ne doit rien ouvrir : c'est le contrôle
		   qui remplace ici le jeton. */
		const {variante} = await creerOuvrage();
		const acheteur = await prisma.user.create({
			data: {email: 'camille@exemple.fr', passwordHash: 'x'},
		});
		const curieux = await prisma.user.create({
			data: {
				email: 'autre@exemple.fr',
				passwordHash: 'x',
				emailVerifiedAt: new Date(),
			},
		});

		const commande = await creerCommandePayee({variante, userId: acheteur.id});
		await delivrerTelechargements(commande.id);

		const droit = await prisma.downloadGrant.findFirst();

		expect(await getFichierDuCompte(droit.id, acheteur)).not.toBeNull();
		expect(await getFichierDuCompte(droit.id, curieux)).toBeNull();
		expect(await getTelechargementsDuCompte(curieux)).toHaveLength(0);
	});

	it('refuse de supprimer un fichier déjà vendu', async () => {
		/* L'accès à vie promis au client tient à ce refus : supprimer la ligne
		   couperait l'accès de ceux qui ont payé, sans que personne ne le voie. */
		const {asset, variante} = await creerOuvrage();
		const commande = await creerCommandePayee({variante});
		await delivrerTelechargements(commande.id);

		const resultat = await supprimerFichier(asset.id);

		expect(resultat.ok).toBe(false);
		expect(await prisma.digitalAsset.count()).toBe(1);
	});

	it('accepte de supprimer un fichier jamais vendu', async () => {
		const {asset} = await creerOuvrage();

		expect((await supprimerFichier(asset.id)).ok).toBe(true);
		expect(await prisma.digitalAsset.count()).toBe(0);
	});
});

/* Le tunnel dématérialisé.

   Ce qui se joue ici est un montant : si le caractère « tout numérique » pouvait
   venir du navigateur, il suffirait d'un champ forgé pour faire sauter les frais
   de port d'un carton de figurines. Il est donc relu du panier en base, et ces
   tests le vérifient depuis l'extérieur — par ce que la commande contient. */
describe.skipIf(!baseDisponible)('commande entièrement dématérialisée', () => {
	const JETON = 'panier-test-numerique';

	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
		dossier = await mkdtemp(path.join(tmpdir(), 'antre-numerique-'));
		process.env.DIGITAL_STORAGE_DIR = dossier;
	});

	it('se passe d’adresse postale et de frais de port', async () => {
		const {variante} = await creerOuvrage();
		await addItem(JETON, variante.id, 1);

		const resultat = await creerCommande({
			token: JETON,
			adresse: {firstName: 'Camille', lastName: 'Renaud', email: 'camille@exemple.fr'},
			rateId: null,
		});

		expect(resultat.ok).toBe(true);

		const commande = await prisma.order.findUnique({
			where: {id: resultat.id},
			include: {addresses: true},
		});

		expect(commande.shippingCents).toBe(0);
		expect(commande.totalCents).toBe(commande.subtotalCents);
		// Aucune adresse enregistrée : nous n'en avons pas demandé, et une adresse
		// vide ferait croire à une expédition en attente en back-office.
		expect(commande.addresses).toHaveLength(0);
		expect(commande.shippingMethod).toBe('Téléchargement');
	});

	it('exige toujours un nom et un e-mail', async () => {
		const {variante} = await creerOuvrage();
		await addItem(JETON, variante.id, 1);

		const sansNom = await creerCommande({
			token: JETON,
			adresse: {firstName: '', lastName: '', email: 'camille@exemple.fr'},
			rateId: null,
		});

		const sansEmail = await creerCommande({
			token: JETON,
			adresse: {firstName: 'Camille', lastName: 'Renaud', email: 'pas-une-adresse'},
			rateId: null,
		});

		expect(sansNom.ok).toBe(false);
		expect(sansEmail.ok).toBe(false);
		expect(await prisma.order.count()).toBe(0);
	});

	it('refuse de sauter la livraison dès qu’un article est physique', async () => {
		/* Le scénario redouté : un panier mixte présenté comme dématérialisé pour
		   économiser les frais de port et l'adresse. */
		const {variante: numerique} = await creerOuvrage();
		const physique = await creerProduit({prixCents: 2000});
		const mode = await creerModeLivraison({prixCents: 590, francoCents: 100000});

		await addItem(JETON, numerique.id, 1);
		await addItem(JETON, physique.variants[0].id, 1);

		const sansAdresse = await creerCommande({
			token: JETON,
			adresse: {firstName: 'Camille', lastName: 'Renaud', email: 'camille@exemple.fr'},
			rateId: mode.id,
		});

		expect(sansAdresse.ok).toBe(false);
		expect(sansAdresse.erreurs).toHaveProperty('line1');

		const complete = await creerCommande({
			token: JETON,
			adresse: {
				firstName: 'Camille',
				lastName: 'Renaud',
				line1: '12 rue des Trouvailles',
				postalCode: '69001',
				city: 'Lyon',
				email: 'camille@exemple.fr',
			},
			rateId: mode.id,
		});

		expect(complete.ok).toBe(true);

		const commande = await prisma.order.findUnique({
			where: {id: complete.id},
			include: {addresses: true},
		});

		// Les frais de port sont bien appliqués : la présence d'un fichier dans le
		// panier ne les efface pas.
		expect(commande.shippingCents).toBe(590);
		expect(commande.addresses).toHaveLength(1);
	});

	it('ne délivre les fichiers qu’au paiement, pas à la commande', async () => {
		/* Une commande naît en attente de paiement. Délivrer les liens à sa
		   création donnerait l'ouvrage à qui abandonne devant la page de paiement. */
		const {variante} = await creerOuvrage();
		await addItem(JETON, variante.id, 1);

		await creerCommande({
			token: JETON,
			adresse: {firstName: 'Camille', lastName: 'Renaud', email: 'camille@exemple.fr'},
			rateId: null,
		});

		expect(await prisma.downloadGrant.count()).toBe(0);
	});
});
