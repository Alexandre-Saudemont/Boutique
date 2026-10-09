import {beforeEach, describe, expect, it} from 'vitest';
import {
	enregistrerMascotte,
	getMascotteActive,
	validerMascotte,
} from '@/server/services/mascottes';
import {baseDisponible, viderLaBase} from './aide';

/* Mascotte du header : validation, et choix de celle qui s'affiche.

   Le choix dépend de la date et de l'état « active » ; l'adresse de l'image
   passe par le même garde-fou que les photos produits, et c'est le test qui
   compte ici — elle atterrit dans un `src` sur chaque page du site. */

const valide = {
	nom: 'Halloween 2026',
	imageUrl: 'https://images.exemple.fr/citrouille.png',
	alt: 'Une citrouille',
	debut: '2026-10-25',
	fin: '2026-11-01',
	actif: true,
};

describe('validerMascotte', () => {
	it('accepte une saisie correcte', () => {
		expect(validerMascotte(valide).valide).toBe(true);
	});

	it('refuse une adresse d’image qui n’est pas en https public', () => {
		for (const imageUrl of ['http://exemple.fr/a.png', 'https://localhost/a.png', 'javascript:alert(1)']) {
			const controle = validerMascotte({...valide, imageUrl});
			expect(controle.valide, imageUrl).toBe(false);
			expect(controle.erreurs.imageUrl).toBeTruthy();
		}
	});

	it('refuse une fin avant le début', () => {
		const controle = validerMascotte({...valide, debut: '2026-11-01', fin: '2026-10-25'});

		expect(controle.valide).toBe(false);
		expect(controle.erreurs.fin).toBeTruthy();
	});

	it('refuse une date illisible', () => {
		expect(validerMascotte({...valide, debut: 'bientôt'}).valide).toBe(false);
	});
});

describe.skipIf(!baseDisponible)('getMascotteActive', () => {
	beforeEach(viderLaBase);

	it('rend la mascotte dont la période contient la date, fin de journée comprise', async () => {
		await enregistrerMascotte(valide);

		expect(await getMascotteActive(new Date('2026-10-30T12:00:00'))).toMatchObject({
			imageUrl: valide.imageUrl,
		});
		// Le dernier jour est inclus jusqu'à minuit.
		expect(await getMascotteActive(new Date('2026-11-01T23:00:00'))).not.toBeNull();
	});

	it('ne rend rien hors période', async () => {
		await enregistrerMascotte(valide);

		expect(await getMascotteActive(new Date('2026-10-24T12:00:00'))).toBeNull();
		expect(await getMascotteActive(new Date('2026-11-02T00:30:00'))).toBeNull();
	});

	it('ignore une mascotte désactivée', async () => {
		await enregistrerMascotte({...valide, actif: false});

		expect(await getMascotteActive(new Date('2026-10-30T12:00:00'))).toBeNull();
	});

	it('départage deux périodes qui se chevauchent : la plus récente l’emporte', async () => {
		await enregistrerMascotte({...valide, nom: 'Automne', debut: '2026-09-01', fin: '2026-11-30'});
		await enregistrerMascotte({...valide, imageUrl: 'https://images.exemple.fr/halloween.png'});

		expect(await getMascotteActive(new Date('2026-10-30T12:00:00'))).toMatchObject({
			imageUrl: 'https://images.exemple.fr/halloween.png',
		});
	});
});
