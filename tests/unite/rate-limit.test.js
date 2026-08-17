import {beforeEach, describe, expect, it, vi} from 'vitest';
import {reinitialiserLimite, verifierLimite} from '@/server/auth/rate-limit';

/* Limitation des tentatives.

   Le compteur vit dans le module : chaque test travaille donc sur une clé qui
   lui est propre, sinon l'ordre d'exécution changerait les résultats. */

let compteur = 0;

function cleUnique() {
	compteur += 1;
	return `test-${compteur}-${Math.random()}`;
}

describe('verifierLimite', () => {
	beforeEach(() => {
		vi.useRealTimers();
	});

	it('laisse passer jusqu’à la limite, puis refuse', () => {
		const cle = cleUnique();

		for (let essai = 1; essai <= 3; essai += 1) {
			expect(verifierLimite(cle, {max: 3}).autorise, `essai ${essai}`).toBe(true);
		}

		expect(verifierLimite(cle, {max: 3}).autorise).toBe(false);
	});

	it('annonce un délai d’attente exploitable', () => {
		const cle = cleUnique();

		verifierLimite(cle, {max: 1, fenetreMs: 60_000});
		const refus = verifierLimite(cle, {max: 1, fenetreMs: 60_000});

		expect(refus.autorise).toBe(false);
		expect(refus.resteSecondes).toBeGreaterThan(0);
		expect(refus.resteSecondes).toBeLessThanOrEqual(60);
	});

	it('compte séparément deux clés — un compte bloqué n’en bloque pas un autre', () => {
		const victime = cleUnique();
		const voisin = cleUnique();

		verifierLimite(victime, {max: 1});
		verifierLimite(victime, {max: 1});

		expect(verifierLimite(voisin, {max: 1}).autorise).toBe(true);
	});

	it('rouvre après la fenêtre', () => {
		const cle = cleUnique();

		vi.useFakeTimers();

		verifierLimite(cle, {max: 2, fenetreMs: 1000});
		verifierLimite(cle, {max: 2, fenetreMs: 1000});
		expect(verifierLimite(cle, {max: 2, fenetreMs: 1000}).autorise).toBe(false);

		vi.advanceTimersByTime(1500);

		expect(verifierLimite(cle, {max: 2, fenetreMs: 1000}).autorise).toBe(true);

		vi.useRealTimers();
	});

	it('glisse au lieu de repartir de zéro par paliers', () => {
		/* Le piège d'un compteur à fenêtre fixe : cinq essais à la fin d'une
		   période et cinq au début de la suivante font dix essais en quelques
		   secondes. Ici, à mi-fenêtre, les tentatives précédentes comptent
		   toujours. */
		const cle = cleUnique();

		vi.useFakeTimers();

		verifierLimite(cle, {max: 2, fenetreMs: 1000});
		verifierLimite(cle, {max: 2, fenetreMs: 1000});

		vi.advanceTimersByTime(600);

		expect(verifierLimite(cle, {max: 2, fenetreMs: 1000}).autorise).toBe(false);

		vi.useRealTimers();
	});
});

describe('reinitialiserLimite', () => {
	it('remet le compteur à zéro après une réussite', () => {
		const cle = cleUnique();

		verifierLimite(cle, {max: 1});
		expect(verifierLimite(cle, {max: 1}).autorise).toBe(false);

		reinitialiserLimite(cle);

		expect(verifierLimite(cle, {max: 1}).autorise).toBe(true);
	});
});
