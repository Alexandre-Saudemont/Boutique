import {beforeEach, describe, expect, it, vi} from 'vitest';

/* PayPal, encaissé par Stripe.

   Ce n'est pas une seconde intégration : même session Checkout, même webhook,
   même solde. Ce qui change tient en deux choses — le moyen imposé à Stripe, et
   la clé d'idempotence qui le porte. Les deux se cassent en silence, d'où ces
   tests.

   Le client Stripe est remplacé par un espion : on vérifie ce qu'on lui demande,
   pas ce qu'il répond. Rien ne part sur le réseau. */

const creerSession = vi.fn(async () => ({url: 'https://checkout.stripe.test/session'}));

vi.mock('stripe', () => ({
	default: class {
		checkout = {sessions: {create: creerSession}};
	},
}));

/* Une commande en attente de paiement, réduite à ce que le service lit. */
const COMMANDE = {
	id: 'cmd_1',
	orderNumber: 'A-2026-001',
	email: 'camille@exemple.fr',
	shippingMethod: 'Colissimo domicile',
	shippingCents: 590,
	items: [
		{kind: 'PHYSICAL', quantity: 1, unitPriceCents: 4000, productName: 'Box Manga', variantName: 'M'},
	],
	payments: [{id: 'pay_1'}],
};

vi.mock('@/server/db', () => ({
	prisma: {order: {findUnique: async () => COMMANDE}},
}));

const {creerSessionPaiement} = await import('@/server/services/payments');

/// Les arguments du dernier appel à Stripe : le corps, puis les options.
function dernierAppel() {
	return creerSession.mock.calls.at(-1);
}

async function ouvrir(moyen) {
	return creerSessionPaiement({
		commandeId: 'cmd_1',
		jetonPanier: 'jeton',
		origine: 'https://antre-geek.fr',
		...(moyen ? {moyen} : {}),
	});
}

describe('creerSessionPaiement', () => {
	beforeEach(() => {
		creerSession.mockClear();
		process.env.STRIPE_SECRET_KEY = 'sk_test_pour_les_tests';
	});

	it('envoie le visiteur directement sur PayPal quand il l’a choisi', async () => {
		/* Sans cette contrainte, Stripe afficherait son propre écran de choix :
		   l'acheteur aurait cliqué « PayPal » chez nous pour se retrouver devant
		   la même question, et se demanderait si son clic a été pris en compte. */
		await ouvrir('paypal');

		expect(dernierAppel()[0].payment_method_types).toEqual(['paypal']);
	});

	it('laisse Stripe choisir pour la carte, sans figer la liste des moyens', async () => {
		/* Fixer `['card']` retirerait Link et les portefeuilles mobiles activés au
		   tableau de bord, sans que personne l'ait demandé. L'absence de la clé
		   est donc volontaire, et c'est exactement ce qu'on vérifie. */
		await ouvrir('carte');

		expect(dernierAppel()[0]).not.toHaveProperty('payment_method_types');
	});

	it('retombe sur la carte quand aucun moyen n’est précisé', async () => {
		await ouvrir();

		expect(dernierAppel()[0]).not.toHaveProperty('payment_method_types');
	});

	it('ouvre une session distincte quand on change de moyen', async () => {
		/* Le cas réel : essayer la carte, renoncer, revenir choisir PayPal. Si la
		   clé d'idempotence ne portait que l'identifiant du paiement, Stripe
		   renverrait la session carte déjà ouverte — le bouton PayPal ramènerait
		   sur un écran de carte, sans que rien ne signale l'incohérence. */
		await ouvrir('carte');
		const cleCarte = dernierAppel()[1].idempotencyKey;

		await ouvrir('paypal');
		const clePaypal = dernierAppel()[1].idempotencyKey;

		expect(cleCarte).not.toBe(clePaypal);
	});

	it('garde la même clé pour deux clics sur le même moyen', async () => {
		// L'autre moitié du contrat : un double clic ne doit pas ouvrir deux
		// sessions ni débiter deux fois.
		await ouvrir('paypal');
		const premiere = dernierAppel()[1].idempotencyKey;

		await ouvrir('paypal');

		expect(dernierAppel()[1].idempotencyKey).toBe(premiere);
	});

	it('facture le même montant quel que soit le moyen', async () => {
		/* Le moyen de paiement ne touche ni aux lignes ni au port : c'est la
		   commande qui fait foi, elle a figé ses prix à la validation. */
		await ouvrir('carte');
		const carte = dernierAppel()[0];

		await ouvrir('paypal');
		const paypal = dernierAppel()[0];

		expect(paypal.line_items).toEqual(carte.line_items);
		expect(paypal.shipping_options).toEqual(carte.shipping_options);
	});
});
