import {describe, expect, it} from 'vitest';
import {
	analyserPanier,
	ligneEnAttente,
	statutApresExpedition,
} from '@/server/services/shipments';

/* Le rangement d'une commande en colis.
 *
 * Sans base : ces fonctions ne décident que sur ce qu'on leur donne. C'est
 * voulu — la règle qui dit ce qui part maintenant et ce qui attend est une
 * décision commerciale, et elle doit pouvoir se relire sans monter un
 * PostgreSQL.
 */

/* Les deux drapeaux ne vivent pas au même endroit — `allowPreorder` sur le
   produit, `allowBackorder` sur la déclinaison — et la fixture respecte cette
   forme. Un objet plat aurait fait passer les tests tout en laissant le code
   lire un champ inexistant en production : c'est exactement l'erreur que ces
   tests existent pour attraper. */
const ligne = (
	{preorder = false, backorder = false, stock = 10} = {},
	quantite = 1,
	kind = 'PHYSICAL',
) => ({
	quantity: quantite,
	variant: {
		allowBackorder: backorder,
		stock,
		product: {kind, allowPreorder: preorder},
	},
});

const variante = (proprietes) => ligne(proprietes).variant;

describe('ce qui attend un réassort', () => {
	it('laisse partir une pièce ordinaire en stock', () => {
		expect(ligneEnAttente(variante({}), 1)).toBe(false);
	});

	/* Le drapeau seul ne suffit pas. Une pièce annoncée en précommande mais qu'on
	   a en rayon part avec le reste : il n'y a rien à attendre, et la scinder
	   ferait payer un second port pour rien. */
	it('laisse partir une précommande dont le stock suffit', () => {
		expect(ligneEnAttente(variante({preorder: true, stock: 5}), 2)).toBe(false);
	});

	it('fait attendre une précommande dont le stock ne suffit pas', () => {
		expect(ligneEnAttente(variante({preorder: true, stock: 1}), 2)).toBe(true);
	});

	/* Une rupture ordinaire ne scinde rien. Sans cette condition, tout produit
	   épuisé déclencherait la question des deux colis alors que le client n'a
	   jamais accepté d'attendre quoi que ce soit. */
	it('ne fait pas attendre une rupture qui n’est pas une précommande', () => {
		expect(ligneEnAttente(variante({preorder: false, stock: 0}), 1)).toBe(false);
	});

	// Le réassort permanent est toujours servi : son stock ne veut rien dire.
	it('laisse partir une déclinaison en réassort permanent, stock nul', () => {
		expect(ligneEnAttente(variante({preorder: true, backorder: true, stock: 0}), 3)).toBe(
			false,
		);
	});
});

describe('un panier est-il scindable', () => {
	it('ne l’est pas quand tout est disponible', () => {
		const resultat = analyserPanier([ligne({}), ligne({})]);

		expect(resultat.scindable).toBe(false);
		expect(resultat.attendues).toHaveLength(0);
	});

	/* Tout attendre n'est pas non plus scindable : il n'y a qu'un seul départ
	   possible, et proposer un choix ne ferait qu'inquiéter. */
	it('ne l’est pas quand tout est en précommande', () => {
		const resultat = analyserPanier([
			ligne({preorder: true, stock: 0}),
			ligne({preorder: true, stock: 0}),
		]);

		expect(resultat.scindable).toBe(false);
		expect(resultat.aDeLAttente).toBe(true);
	});

	it('l’est quand il mêle du disponible et de l’attendu', () => {
		const resultat = analyserPanier([ligne({}), ligne({preorder: true, stock: 0})]);

		expect(resultat.scindable).toBe(true);
		expect(resultat.immediates).toHaveLength(1);
		expect(resultat.attendues).toHaveLength(1);
	});

	/* Un ouvrage à télécharger ne part dans aucun colis. Accompagné d'une
	   figurine en précommande, il ne fait pas une commande scindable : il n'y a
	   qu'une seule chose à expédier. */
	it('ignore les lignes numériques', () => {
		const resultat = analyserPanier([
			ligne({}, 1, 'DIGITAL'),
			ligne({preorder: true, stock: 0}),
		]);

		expect(resultat.scindable).toBe(false);
		expect(resultat.immediates).toHaveLength(0);
	});
});

describe('le statut après l’expédition d’un colis', () => {
	it('passe à « expédiée » quand tout est parti', () => {
		expect(statutApresExpedition([{shippedAt: new Date()}])).toBe('SHIPPED');
	});

	it('reste « partiellement expédiée » tant qu’un colis attend', () => {
		expect(statutApresExpedition([{shippedAt: new Date()}, {shippedAt: null}])).toBe(
			'PARTIALLY_SHIPPED',
		);
	});

	it('passe à « expédiée » au départ du second colis', () => {
		expect(statutApresExpedition([{shippedAt: new Date()}, {shippedAt: new Date()}])).toBe(
			'SHIPPED',
		);
	});
});
