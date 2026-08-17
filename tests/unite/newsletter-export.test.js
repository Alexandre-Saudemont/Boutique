import {describe, expect, it, vi} from 'vitest';

/* Export CSV de la liste d'abonnés.

   Le service parle à Prisma : on remplace le client par un faux, puisque ce
   qu'on teste ici est la mise en forme du fichier, pas la requête.

   Ce que ces tests protègent : l'injection de formule dans un tableur. Une
   adresse e-mail est saisie par n'importe quel visiteur ; si elle atterrit
   telle quelle dans une cellule commençant par `=`, Excel l'exécute à
   l'ouverture — chez le client, sur son poste. */

const abonnes = [
	{
		id: '1',
		email: 'camille@exemple.fr',
		consentAt: new Date('2026-07-01T10:00:00Z'),
		confirmedAt: null,
		unsubscribedAt: null,
		source: 'footer',
	},
	{
		id: '2',
		email: '=cmd|"/c calc"!A1',
		consentAt: new Date('2026-07-02T10:00:00Z'),
		confirmedAt: null,
		unsubscribedAt: null,
		source: 'checkout',
	},
	{
		id: '3',
		email: 'guillemet"et;point-virgule@exemple.fr',
		consentAt: new Date('2026-07-03T10:00:00Z'),
		confirmedAt: null,
		unsubscribedAt: new Date('2026-07-10T10:00:00Z'),
		source: null,
	},
];

vi.mock('@/server/db', () => ({
	prisma: {
		newsletterSubscriber: {
			findMany: async () => abonnes,
		},
	},
}));

const {abonnesEnCsv} = await import('@/server/services/newsletter');

describe('abonnesEnCsv', () => {
	it('commence par le BOM UTF-8 attendu par Excel', async () => {
		const csv = await abonnesEnCsv();

		// Sans lui, « é » s'affiche en charabia dans un tableur français.
		expect(csv.charCodeAt(0)).toBe(0xfeff);
	});

	it('sépare par des points-virgules et une ligne par abonné', async () => {
		const lignes = (await abonnesEnCsv()).split('\r\n');

		expect(lignes).toHaveLength(4); // en-tête + trois abonnés
		expect(lignes[0]).toContain('E-mail;');
	});

	it('neutralise une cellule qui commencerait comme une formule', async () => {
		const csv = await abonnesEnCsv();

		expect(csv).toContain(`"'=cmd|""/c calc""!A1"`);
		expect(csv).not.toMatch(/(^|;)=cmd/m);
	});

	it('échappe les guillemets et protège les séparateurs', async () => {
		const csv = await abonnesEnCsv();

		expect(csv).toContain('"guillemet""et;point-virgule@exemple.fr"');
	});

	it('laisse vide ce qui n’a pas de valeur, sans écrire « null »', async () => {
		const csv = await abonnesEnCsv();

		expect(csv).not.toContain('null');
		expect(csv).not.toContain('undefined');
	});
});
