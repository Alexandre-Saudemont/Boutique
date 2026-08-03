import {beforeEach, describe, expect, it} from 'vitest';
import {
	appliquerCodeAuPanier,
	calculerReduction,
	enregistrerCode,
	verifierCode,
} from '@/server/services/discounts';
import {getCart, addItem} from '@/server/services/cart';
import {creerCommande} from '@/server/services/checkout';
import {
	baseDisponible,
	creerModeLivraison,
	creerProduit,
	ouvrirLaBoutique,
	prisma,
	viderLaBase,
} from './aide';

/* Codes de réduction.

   Le test central de ce fichier est celui du franco de port : **la livraison
   offerte se juge sur ce que le client paie réellement, après réduction**.
   C'est la décision du client (question 3b), et elle doit tenir aux trois
   endroits où le calcul apparaît — panier, tunnel, commande. */

const ADRESSE = {
	firstName: 'Camille',
	lastName: 'Durand',
	line1: '12 rue des Lilas',
	postalCode: '69003',
	city: 'Lyon',
	email: 'camille@exemple.fr',
};

describe.skipIf(!baseDisponible)('validité d’un code', () => {
	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
	});

	it('accepte un code actif', async () => {
		await enregistrerCode({code: 'bienvenue10', type: 'PERCENT', valeur: '10', actif: true});

		// La saisie est normalisée : un code se dicte au téléphone, la casse ne
		// doit pas compter.
		const resultat = await verifierCode('  BienVenue10 ', 5000);

		expect(resultat.ok).toBe(true);
		expect(resultat.promo.code).toBe('BIENVENUE10');
	});

	it('refuse un code inconnu ou désactivé', async () => {
		await enregistrerCode({code: 'DORMANT', type: 'FIXED', valeur: '5', actif: false});

		expect((await verifierCode('INEXISTANT', 5000)).ok).toBe(false);
		expect((await verifierCode('DORMANT', 5000)).ok).toBe(false);
	});

	it('refuse un code expiré ou pas encore ouvert', async () => {
		await enregistrerCode({
			code: 'PASSE',
			type: 'FIXED',
			valeur: '5',
			actif: true,
			fin: '2020-01-01',
		});
		await enregistrerCode({
			code: 'FUTUR',
			type: 'FIXED',
			valeur: '5',
			actif: true,
			debut: '2099-01-01',
		});

		expect((await verifierCode('PASSE', 5000)).ok).toBe(false);
		expect((await verifierCode('FUTUR', 5000)).ok).toBe(false);
	});

	it('exige le panier minimum et le dit', async () => {
		await enregistrerCode({
			code: 'GROSPANIER',
			type: 'FIXED',
			valeur: '10',
			minimum: '50',
			actif: true,
		});

		const refus = await verifierCode('GROSPANIER', 4999);

		expect(refus.ok).toBe(false);
		// Le message doit permettre de comprendre qu'il manque quelques euros,
		// plutôt que de laisser croire à une faute de frappe.
		expect(refus.erreur).toContain('50,00');

		expect((await verifierCode('GROSPANIER', 5000)).ok).toBe(true);
	});

	it('refuse un code dont le quota est atteint', async () => {
		await enregistrerCode({
			code: 'LIMITE',
			type: 'FIXED',
			valeur: '5',
			maxUtilisations: '1',
			actif: true,
		});
		await prisma.discountCode.updateMany({where: {code: 'LIMITE'}, data: {usedCount: 1}});

		expect((await verifierCode('LIMITE', 5000)).ok).toBe(false);
	});

	it('refuse un code vide', async () => {
		expect((await verifierCode('   ', 5000)).ok).toBe(false);
	});
});

describe('calcul de la réduction', () => {
	it('applique un pourcentage en points de base', () => {
		expect(calculerReduction({type: 'PERCENT', percentBp: 1500}, 10000).reductionCents).toBe(1500);
	});

	it('arrondit le pourcentage au centime inférieur', () => {
		// 3333 × 15 % = 499,95 centimes : on garde 499, jamais 500.
		expect(calculerReduction({type: 'PERCENT', percentBp: 1500}, 3333).reductionCents).toBe(499);
	});

	it('ne réduit jamais en dessous de zéro', () => {
		/* Un code de 20 € sur un panier de 15 € ramène à zéro, il ne crée pas
		   d'avoir — sans cette borne, un total négatif remonterait au paiement. */
		expect(calculerReduction({type: 'FIXED', amountCents: 2000}, 1500).reductionCents).toBe(1500);
	});

	it('traite la livraison offerte à part du sous-total', () => {
		const resultat = calculerReduction({type: 'FREE_SHIPPING'}, 5000);

		expect(resultat.reductionCents).toBe(0);
		expect(resultat.livraisonOfferte).toBe(true);
	});

	it('ne réduit rien sans code', () => {
		expect(calculerReduction(null, 5000).reductionCents).toBe(0);
	});
});

describe.skipIf(!baseDisponible)('franco de port après réduction', () => {
	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique({'shipping.freeAboveCents': 5000});
	});

	it('retire la livraison offerte quand le code fait passer sous le seuil', async () => {
		/* Le cas exact de la question 3b : panier à 55 €, code de 10 €, on tombe
		   à 45 € — donc sous le seuil de 50 €, et la livraison redevient payante. */
		await enregistrerCode({code: 'MOINS10', type: 'FIXED', valeur: '10', actif: true});

		const resultat = await appliquerCodeAuPanier('MOINS10', 5500);

		expect(resultat.reductionCents).toBe(1000);
		expect(resultat.baseFrancoCents).toBe(4500);
	});

	it('se reflète dans le panier affiché', async () => {
		await enregistrerCode({code: 'MOINS10', type: 'FIXED', valeur: '10', actif: true});
		const produit = await creerProduit({prixCents: 5500, stock: 3});
		await addItem('jeton-a', produit.variants[0].id, 1);

		const sans = await getCart('jeton-a');
		const avec = await getCart('jeton-a', 'MOINS10');

		expect(sans.franco.atteint).toBe(true);
		expect(avec.franco.atteint).toBe(false);
		expect(avec.reductionCents).toBe(1000);
		expect(avec.totalApresReductionCents).toBe(4500);
	});

	it('facture la livraison sur la commande, franco perdu', async () => {
		await enregistrerCode({code: 'MOINS10', type: 'FIXED', valeur: '10', actif: true});
		const mode = await creerModeLivraison({prixCents: 590, francoCents: 5000});
		const produit = await creerProduit({prixCents: 5500, stock: 3});
		await addItem('jeton-a', produit.variants[0].id, 1);

		const resultat = await creerCommande({
			token: 'jeton-a',
			adresse: ADRESSE,
			rateId: mode.id,
			codePromo: 'MOINS10',
		});

		const commande = await prisma.order.findUnique({where: {id: resultat.id}});

		expect(commande.subtotalCents).toBe(5500);
		expect(commande.discountCents).toBe(1000);
		expect(commande.shippingCents).toBe(590);
		expect(commande.totalCents).toBe(5090);
		expect(commande.discountCode).toBe('MOINS10');
	});

	it('garde le franco quand la réduction laisse au-dessus du seuil', async () => {
		await enregistrerCode({code: 'MOINS5', type: 'FIXED', valeur: '5', actif: true});
		const mode = await creerModeLivraison({prixCents: 590, francoCents: 5000});
		const produit = await creerProduit({prixCents: 6000, stock: 3});
		await addItem('jeton-a', produit.variants[0].id, 1);

		const resultat = await creerCommande({
			token: 'jeton-a',
			adresse: ADRESSE,
			rateId: mode.id,
			codePromo: 'MOINS5',
		});

		const commande = await prisma.order.findUnique({where: {id: resultat.id}});

		expect(commande.shippingCents).toBe(0);
		expect(commande.totalCents).toBe(5500);
	});

	it('met les frais de port à zéro avec un code « livraison offerte »', async () => {
		await enregistrerCode({code: 'PORTOFFERT', type: 'FREE_SHIPPING', actif: true});
		const mode = await creerModeLivraison({prixCents: 590, francoCents: 5000});
		const produit = await creerProduit({prixCents: 2000, stock: 3});
		await addItem('jeton-a', produit.variants[0].id, 1);

		const resultat = await creerCommande({
			token: 'jeton-a',
			adresse: ADRESSE,
			rateId: mode.id,
			codePromo: 'PORTOFFERT',
		});

		const commande = await prisma.order.findUnique({where: {id: resultat.id}});

		expect(commande.discountCents).toBe(0);
		expect(commande.shippingCents).toBe(0);
		expect(commande.totalCents).toBe(2000);
	});
});

describe.skipIf(!baseDisponible)('usage d’un code', () => {
	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
	});

	it('n’incrémente le compteur qu’à la commande, pas à la saisie', async () => {
		/* Sinon un visiteur qui teste un code puis renonce consommerait une
		   utilisation : un code limité à cinquante usages s'épuiserait sans une
		   seule vente. */
		await enregistrerCode({code: 'MOINS5', type: 'FIXED', valeur: '5', actif: true});

		await verifierCode('MOINS5', 5000);
		await appliquerCodeAuPanier('MOINS5', 5000);

		expect((await prisma.discountCode.findFirst()).usedCount).toBe(0);

		const mode = await creerModeLivraison();
		const produit = await creerProduit({prixCents: 5000, stock: 3});
		await addItem('jeton-a', produit.variants[0].id, 1);
		await creerCommande({
			token: 'jeton-a',
			adresse: ADRESSE,
			rateId: mode.id,
			codePromo: 'MOINS5',
		});

		expect((await prisma.discountCode.findFirst()).usedCount).toBe(1);
	});

	it('ignore un code invalide au moment de commander, sans échouer', async () => {
		// La commande doit passer : le client a déjà tout saisi, refuser ici pour
		// un code périmé entre-temps lui ferait tout recommencer.
		const mode = await creerModeLivraison();
		const produit = await creerProduit({prixCents: 3000, stock: 3});
		await addItem('jeton-a', produit.variants[0].id, 1);

		const resultat = await creerCommande({
			token: 'jeton-a',
			adresse: ADRESSE,
			rateId: mode.id,
			codePromo: 'CODE-QUI-NEXISTE-PAS',
		});

		expect(resultat.ok).toBe(true);

		const commande = await prisma.order.findUnique({where: {id: resultat.id}});
		expect(commande.discountCents).toBe(0);
		expect(commande.discountCode).toBeNull();
	});

	it('refuse deux codes portant le même nom', async () => {
		await enregistrerCode({code: 'UNIQUE', type: 'FIXED', valeur: '5', actif: true});

		const second = await enregistrerCode({code: 'unique', type: 'FIXED', valeur: '9', actif: true});

		expect(second.ok).toBe(false);
		expect(second.erreurs.code).toBeTruthy();
	});

	it('refuse un pourcentage hors bornes ou un montant illisible', async () => {
		expect((await enregistrerCode({code: 'TROP', type: 'PERCENT', valeur: '150'})).ok).toBe(false);
		expect((await enregistrerCode({code: 'ZERO', type: 'PERCENT', valeur: '0'})).ok).toBe(false);
		expect((await enregistrerCode({code: 'FLOU', type: 'FIXED', valeur: 'dix'})).ok).toBe(false);
	});

	it('refuse un code mal formé', async () => {
		expect((await enregistrerCode({code: 'AB', type: 'FIXED', valeur: '5'})).ok).toBe(false);
		expect((await enregistrerCode({code: 'AVEC ESPACE', type: 'FIXED', valeur: '5'})).ok).toBe(
			false,
		);
	});
});
