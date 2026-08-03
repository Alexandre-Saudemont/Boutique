import {describe, expect, it, vi} from 'vitest';

/* Enregistrement des réglages.

   Deux dangers guettent un formulaire de réglages, et ce sont eux qu'on teste :
   une clé inventée depuis le navigateur qui atterrirait en base, et une case
   décochée qui resterait cochée — parce qu'un navigateur n'envoie tout
   simplement pas les cases non cochées. */

const ecrites = new Map();

vi.mock('@/server/db', () => ({
	prisma: {
		setting: {
			upsert: ({where, create}) => {
				ecrites.set(where.key, create.value);
				return Promise.resolve();
			},
			findMany: async () => [],
			findUnique: async () => null,
		},
		$transaction: async (operations) => Promise.all(operations),
	},
}));

const {REGLAGES_MODIFIABLES, enregistrerReglages} = await import('@/server/services/settings');

/// Un FormData minimal, comme celui que poste le formulaire.
function formulaire(valeurs) {
	const donnees = new FormData();

	for (const [cle, valeur] of Object.entries(valeurs)) donnees.append(cle, valeur);

	return donnees;
}

describe('enregistrerReglages', () => {
	it('convertit les euros saisis en centimes', async () => {
		ecrites.clear();

		await enregistrerReglages(formulaire({'shipping.freeAboveCents': '50,00'}));

		expect(ecrites.get('shipping.freeAboveCents')).toBe(5000);
	});

	it('lit une case cochée comme vrai', async () => {
		ecrites.clear();

		await enregistrerReglages(formulaire({'shop.open': 'on'}));

		expect(ecrites.get('shop.open')).toBe(true);
	});

	it('lit une case absente comme faux — sinon fermer la boutique n’aurait aucun effet', async () => {
		ecrites.clear();

		// Le formulaire est envoyé sans « shop.open » : c'est exactement ce que
		// fait un navigateur quand la case est décochée.
		await enregistrerReglages(formulaire({'shop.name': 'L’antre'}));

		expect(ecrites.get('shop.open')).toBe(false);
		expect(ecrites.get('checkout.guestAllowed')).toBe(false);
	});

	it('ignore une clé qui n’est pas dans la liste des réglages modifiables', async () => {
		ecrites.clear();

		await enregistrerReglages(
			formulaire({'admin.superPouvoir': 'true', 'vat.regime': 'FRANCHISE'}),
		);

		expect(ecrites.has('admin.superPouvoir')).toBe(false);
		expect(ecrites.get('vat.regime')).toBe('FRANCHISE');
	});

	it('refuse une valeur hors des choix proposés', async () => {
		ecrites.clear();

		await enregistrerReglages(formulaire({'vat.regime': 'EXONERE_TOTAL'}));

		expect(ecrites.has('vat.regime')).toBe(false);
	});

	it('ignore un montant illisible plutôt que d’écrire NaN', async () => {
		ecrites.clear();

		// Un franco de port à NaN rendrait toutes les comparaisons fausses : la
		// livraison ne serait plus jamais offerte, sans message d'erreur.
		await enregistrerReglages(formulaire({'shipping.freeAboveCents': 'cinquante'}));

		expect(ecrites.has('shipping.freeAboveCents')).toBe(false);
	});

	it('décrit chaque réglage modifiable avec un libellé et un type', () => {
		for (const [cle, descripteur] of Object.entries(REGLAGES_MODIFIABLES)) {
			expect(descripteur.libelle, cle).toBeTruthy();
			expect(['texte', 'booleen', 'euros', 'choix'], cle).toContain(descripteur.type);
		}
	});
});
