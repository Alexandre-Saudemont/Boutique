import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {addItem, getCart, removeItem, setQuantity} from '@/server/services/cart';
import {baseDisponible, creerProduit, ouvrirLaBoutique, prisma, viderLaBase} from './aide';

/* Le panier, contre une vraie base.

   Ce qui se joue ici est une question de sécurité autant que de commerce : le
   panier d'un visiteur ne doit être ni lisible ni modifiable par un autre. Les
   clauses `where` qui l'assurent ne se vérifient pas à la lecture du code —
   elles se vérifient en essayant. */

describe.skipIf(!baseDisponible)('panier', () => {
	beforeAll(() => {
		// Garde-fou : ces tests vident la base. Qu'on ne se trompe jamais de cible.
		expect(process.env.DATABASE_URL).toContain('_test');
	});

	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
	});

	it('ajoute une pièce et la retrouve', async () => {
		const produit = await creerProduit({prixCents: 7490});

		const ajout = await addItem('jeton-a', produit.variants[0].id, 2);
		expect(ajout.ok).toBe(true);

		const panier = await getCart('jeton-a');
		expect(panier.lignes).toHaveLength(1);
		expect(panier.nombreArticles).toBe(2);
		expect(panier.sousTotalCents).toBe(14980);
	});

	it('n’expose jamais le panier d’un autre visiteur', async () => {
		const produit = await creerProduit();
		await addItem('jeton-a', produit.variants[0].id, 1);

		const panierVoisin = await getCart('jeton-b');

		expect(panierVoisin.lignes).toHaveLength(0);
		expect(panierVoisin.sousTotalCents).toBe(0);
	});

	it('empêche de modifier la ligne d’un autre, même en connaissant son identifiant', async () => {
		const produit = await creerProduit();
		await addItem('jeton-a', produit.variants[0].id, 1);

		const panier = await getCart('jeton-a');
		const ligneId = panier.lignes[0].id;

		// Le voisin devine l'identifiant et tente sa chance.
		const modification = await setQuantity('jeton-b', ligneId, 9);
		const suppression = await removeItem('jeton-b', ligneId);

		expect(modification.ok).toBe(false);
		expect(suppression.ok).toBe(false);

		// Et le panier légitime n'a pas bougé d'un pouce.
		const apres = await getCart('jeton-a');
		expect(apres.lignes).toHaveLength(1);
		expect(apres.lignes[0].quantite).toBe(1);
	});

	it('refuse tout ajout quand la boutique est fermée', async () => {
		await ouvrirLaBoutique({'shop.open': false});
		const produit = await creerProduit();

		const ajout = await addItem('jeton-a', produit.variants[0].id, 1);

		expect(ajout.ok).toBe(false);
	});

	it('refuse une pièce non publiée ou désactivée', async () => {
		const brouillon = await creerProduit({publie: false});
		const desactive = await creerProduit({actif: false});

		expect((await addItem('jeton-a', brouillon.variants[0].id, 1)).ok).toBe(false);
		expect((await addItem('jeton-a', desactive.variants[0].id, 1)).ok).toBe(false);
	});

	it('refuse un identifiant de variante inventé', async () => {
		expect((await addItem('jeton-a', 'variante-qui-nexiste-pas', 1)).ok).toBe(false);
	});

	it('plafonne la quantité au stock disponible', async () => {
		const produit = await creerProduit({stock: 2});

		const ajout = await addItem('jeton-a', produit.variants[0].id, 9);

		expect(ajout.ok).toBe(true);
		expect(ajout.quantite).toBe(2);
		expect(ajout.plafonne).toBe(true);
	});

	it('plafonne à neuf pièces même si le stock est immense', async () => {
		// Sans ce plafond, un seul visiteur peut réserver tout le stock d'une
		// pièce rare en une requête.
		const produit = await creerProduit({stock: 500});

		const ajout = await addItem('jeton-a', produit.variants[0].id, 400);

		expect(ajout.quantite).toBe(9);
	});

	it('cumule les ajouts successifs au lieu de les écraser', async () => {
		const produit = await creerProduit({stock: 10});

		await addItem('jeton-a', produit.variants[0].id, 3);
		await addItem('jeton-a', produit.variants[0].id, 2);

		expect((await getCart('jeton-a')).nombreArticles).toBe(5);
	});

	it('refuse une pièce en rupture, sauf vente à découvert autorisée', async () => {
		const rupture = await creerProduit({stock: 0});
		const precommande = await creerProduit({stock: 0, allowBackorder: true});

		expect((await addItem('jeton-a', rupture.variants[0].id, 1)).ok).toBe(false);
		expect((await addItem('jeton-a', precommande.variants[0].id, 1)).ok).toBe(true);
	});

	it('normalise une quantité absurde plutôt que de la propager', async () => {
		const produit = await creerProduit({stock: 10});

		for (const quantite of [-5, 0, 2.7, Number.NaN, 'beaucoup']) {
			await prisma.cartItem.deleteMany({});
			const ajout = await addItem('jeton-a', produit.variants[0].id, quantite);

			expect(ajout.ok, String(quantite)).toBe(true);
			expect(ajout.quantite, String(quantite)).toBeGreaterThanOrEqual(1);
			expect(Number.isInteger(ajout.quantite), String(quantite)).toBe(true);
		}
	});

	it('retire la ligne quand la quantité tombe à zéro', async () => {
		const produit = await creerProduit();
		await addItem('jeton-a', produit.variants[0].id, 2);
		const {lignes} = await getCart('jeton-a');

		await setQuantity('jeton-a', lignes[0].id, 0);

		expect((await getCart('jeton-a')).lignes).toHaveLength(0);
	});

	it('relit le prix courant plutôt que celui du jour de l’ajout', async () => {
		/* Le panier ne fige rien : c'est la commande qui recopie les montants. Un
		   panier abandonné trois semaines ne doit pas ressusciter un vieux prix. */
		const produit = await creerProduit({prixCents: 1000});
		await addItem('jeton-a', produit.variants[0].id, 1);

		await prisma.productVariant.update({
			where: {id: produit.variants[0].id},
			data: {priceCents: 1200},
		});

		expect((await getCart('jeton-a')).sousTotalCents).toBe(1200);
	});

	it('ne crée aucun panier à la simple lecture', async () => {
		await getCart('jeton-de-robot');

		expect(await prisma.cart.count()).toBe(0);
	});

	it('calcule le franco de port à partir des réglages', async () => {
		await ouvrirLaBoutique({'shipping.freeAboveCents': 5000});
		const produit = await creerProduit({prixCents: 3000, stock: 5});

		await addItem('jeton-a', produit.variants[0].id, 1);
		const avant = await getCart('jeton-a');

		expect(avant.franco.atteint).toBe(false);
		expect(avant.franco.resteCents).toBe(2000);

		await addItem('jeton-a', produit.variants[0].id, 1);
		const apres = await getCart('jeton-a');

		expect(apres.franco.atteint).toBe(true);
		expect(apres.franco.resteCents).toBe(0);
	});
});

/* La précommande au panier.
 *
   Sans cette règle, un produit annoncé pour octobre et dont le stock vaut zéro
   se voyait refuser l'ajout au panier : impossible d'en vendre un seul, et toute
   la livraison en deux colis restait sans objet. Le test verrouille le
   comportement — c'est le genre de règle qu'une relecture distraite de
   `disponible()` ferait sauter sans que rien ne proteste. */
describe.skipIf(!baseDisponible)('précommande', () => {
	beforeAll(() => {
		expect(process.env.DATABASE_URL).toContain('_test');
	});

	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
	});

	it('accepte au panier une précommande dont le stock est nul', async () => {
		const produit = await creerProduit({stock: 0, allowPreorder: true});

		const resultat = await addItem('jeton-precommande', produit.variants[0].id, 2);

		expect(resultat.ok).toBe(true);

		const panier = await getCart('jeton-precommande');
		expect(panier.lignes).toHaveLength(1);
		expect(panier.lignes[0].quantite).toBe(2);
	});

	it('refuse toujours une rupture ordinaire', async () => {
		const produit = await creerProduit({stock: 0, allowPreorder: false});

		expect((await addItem('jeton-rupture', produit.variants[0].id, 1)).ok).toBe(false);
	});
});
