import {describe, expect, it, vi} from 'vitest';

/* Le livre des recettes, l'obligation comptable du régime micro.

   Le service parle à Prisma : on remplace le client par un faux, puisque ce
   qu'on teste ici est la constitution du livre, pas la requête.

   Ce que ces tests protègent, dans l'ordre d'importance :

   1. Qu'aucune recette encaissée ne disparaisse du livre. C'est exactement ce
      qu'un contrôle cherche, et le piège est de filtrer sur le statut plutôt
      que sur l'encaissement — une commande remboursée a bien été encaissée.
   2. Que rien qui n'a pas été encaissé n'y figure. Un panier abandonné n'est
      pas une recette.
   3. Que l'exercice soit découpé à l'heure française, pas en UTC. Une commande
      de la nuit du réveillon bascule sinon d'une année sur l'autre.
   4. L'injection de formule dans un tableur, comme pour l'export des abonnés :
      le nom du client et son e-mail sont saisis par l'acheteur. */

const commandes = [
	{
		orderNumber: 'AVGF-2026-000001',
		email: 'camille@exemple.fr',
		paidAt: new Date('2026-03-04T09:00:00Z'),
		status: 'DELIVERED',
		vatRegime: 'FRANCHISE',
		subtotalCents: 4500,
		discountCents: 500,
		shippingCents: 590,
		vatCents: 0,
		totalCents: 4590,
		payments: [{provider: 'STRIPE', status: 'SUCCEEDED', refundedCents: 0}],
		addresses: [{type: 'BILLING', firstName: 'Camille', lastName: 'Roux'}],
	},
	{
		// Remboursée : l'argent a bien été encaissé, elle reste au livre.
		orderNumber: 'AVGF-2026-000002',
		email: 'litige@exemple.fr',
		paidAt: new Date('2026-05-20T09:00:00Z'),
		status: 'REFUNDED',
		vatRegime: 'FRANCHISE',
		subtotalCents: 2000,
		discountCents: 0,
		shippingCents: 0,
		vatCents: 0,
		totalCents: 2000,
		payments: [{provider: 'STRIPE', status: 'REFUNDED', refundedCents: 2000}],
		addresses: [{type: 'BILLING', firstName: 'Sacha', lastName: 'Meyer'}],
	},
	{
		// Nom forgé par l'acheteur : ne doit jamais s'exécuter à l'ouverture.
		orderNumber: 'AVGF-2026-000003',
		email: 'invite@exemple.fr',
		paidAt: new Date('2026-07-02T09:00:00Z'),
		status: 'PAID',
		vatRegime: 'FRANCHISE',
		subtotalCents: 1000,
		discountCents: 0,
		shippingCents: 0,
		vatCents: 0,
		totalCents: 1000,
		payments: [{provider: 'PAYPAL', status: 'SUCCEEDED', refundedCents: 0}],
		addresses: [{type: 'BILLING', firstName: '=cmd|"/c calc"!A1', lastName: 'Point;Virgule'}],
	},
];

let dernierWhere = null;

vi.mock('@/server/db', () => ({
	prisma: {
		order: {
			findMany: async ({where}) => {
				dernierWhere = where;
				// Le service demande une période : on ne renvoie que ce qui tombe
				// dedans, comme le ferait PostgreSQL.
				if (!where?.paidAt?.gte) return commandes.map((c) => ({paidAt: c.paidAt}));

				return commandes.filter(
					(c) => c.paidAt >= where.paidAt.gte && c.paidAt < where.paidAt.lt,
				);
			},
		},
	},
}));

const {exercicesDeRecettes, livreDesRecettes, livreDesRecettesEnCsv} = await import(
	'@/server/services/orders'
);

describe('livreDesRecettes', () => {
	it('retient l’encaissement et non le statut de la commande', async () => {
		const {lignes} = await livreDesRecettes(2026);

		// La remboursée est là : l'argent est passé, la recette a existé.
		expect(lignes.map((l) => l.numero)).toContain('AVGF-2026-000002');
		expect(lignes).toHaveLength(3);
	});

	it('ne demande à la base que ce qui a été payé', async () => {
		await livreDesRecettes(2026);

		// Sans borne sur paidAt, les paniers abandonnés entreraient au livre.
		expect(dernierWhere.paidAt.gte).toBeInstanceOf(Date);
		expect(dernierWhere.paidAt.lt).toBeInstanceOf(Date);
	});

	it('découpe l’exercice à l’heure française et non en UTC', async () => {
		const {debut, finExclue} = {
			debut: dernierWhere.paidAt.gte,
			finExclue: dernierWhere.paidAt.lt,
		};

		// 1er janvier 2026, 00 h 00 à Paris = 31 décembre 2025, 23 h 00 UTC.
		expect(debut.toISOString()).toBe('2025-12-31T23:00:00.000Z');
		expect(finExclue.toISOString()).toBe('2026-12-31T23:00:00.000Z');
	});

	it('sépare le remboursement de la recette au lieu de le soustraire', async () => {
		const {lignes, totaux} = await livreDesRecettes(2026);
		const remboursee = lignes.find((l) => l.numero === 'AVGF-2026-000002');

		expect(remboursee.totalCents).toBe(2000);
		expect(remboursee.rembourseCents).toBe(2000);

		expect(totaux.encaisseCents).toBe(4590 + 2000 + 1000);
		expect(totaux.rembourseCents).toBe(2000);
		expect(totaux.netCents).toBe(4590 + 1000);
	});

	it('déduit la remise du montant produits', async () => {
		const {lignes} = await livreDesRecettes(2026);

		// 45,00 € de produits moins 5,00 € de remise.
		expect(lignes[0].produitsCents).toBe(4000);
		expect(lignes[0].portCents).toBe(590);
	});

	it('nomme le client d’après l’adresse de facturation figée', async () => {
		const {lignes} = await livreDesRecettes(2026);

		expect(lignes[0].client).toBe('Camille Roux');
	});
});

describe('livreDesRecettesEnCsv', () => {
	it('neutralise un nom qui commencerait comme une formule', async () => {
		const csv = await livreDesRecettesEnCsv(2026);

		expect(csv).toContain(`"'=cmd|""/c calc""!A1 Point;Virgule"`);
		expect(csv).not.toMatch(/(^|;)=cmd/m);
	});

	it('écrit les montants avec une virgule, sans symbole monétaire', async () => {
		const csv = await livreDesRecettesEnCsv(2026);

		// « 45,90 » et non « 45.90 » ni « 45,90 € » : le tableur doit pouvoir
		// additionner la colonne.
		expect(csv).toContain('45,90');
		expect(csv).not.toContain('45.90');
		expect(csv).not.toContain('€;');
	});

	it('écrit les dates en jj/mm/aaaa', async () => {
		const csv = await livreDesRecettesEnCsv(2026);

		expect(csv).toContain('04/03/2026');
	});

	it('mentionne la franchise en base de TVA', async () => {
		const csv = await livreDesRecettesEnCsv(2026);

		expect(csv).toContain('art. 293 B du CGI');
	});

	it('porte le total et les recettes nettes en pied de livre', async () => {
		const csv = await livreDesRecettesEnCsv(2026);

		expect(csv).toContain('Total 2026');
		expect(csv).toContain('Recettes nettes 2026;55,90');
	});

	it('commence par le BOM UTF-8 attendu par Excel', async () => {
		const csv = await livreDesRecettesEnCsv(2026);

		expect(csv.charCodeAt(0)).toBe(0xfeff);
	});
});

describe('exercicesDeRecettes', () => {
	it('ne propose que les années où quelque chose a été encaissé', async () => {
		expect(await exercicesDeRecettes()).toEqual([2026]);
	});
});
