import {describe, expect, it} from 'vitest';
import {autoriseCron} from '@/server/auth/cron';

/* Garde du point d'entrée de ménage.

   Ce n'est pas la route la plus sensible du site — elle ne lit rien et ne
   supprime que des lignes déjà périmées — mais c'est une route publique qui
   écrit en base. Les tests décrivent ce qui doit être refusé, et surtout le cas
   de l'oubli de configuration : sans secret, tout est refusé, jamais l'inverse. */

const SECRET = 'un-secret-de-cron-tire-au-hasard';

describe('autorisation du ménage programmé', () => {
	it('accepte le secret attendu', () => {
		expect(autoriseCron(`Bearer ${SECRET}`, SECRET)).toBe(true);
	});

	it('refuse tout quand aucun secret n’est configuré', () => {
		/* Le scénario redouté : la variable d'environnement manque en production.
		   Un code qui « laisse passer si rien n'est configuré » ouvrirait la route
		   sans que rien ne le signale, puisque le site continue de marcher. */
		expect(autoriseCron(`Bearer ${SECRET}`, undefined)).toBe(false);
		expect(autoriseCron('Bearer ', '')).toBe(false);
		expect(autoriseCron('Bearer', '')).toBe(false);
	});

	it('refuse un en-tête absent, vide ou mal formé', () => {
		expect(autoriseCron(null, SECRET)).toBe(false);
		expect(autoriseCron('', SECRET)).toBe(false);
		expect(autoriseCron(SECRET, SECRET)).toBe(false); // sans le préfixe
		expect(autoriseCron(`bearer ${SECRET}`, SECRET)).toBe(false); // casse différente
	});

	it('refuse un secret approchant', () => {
		expect(autoriseCron(`Bearer ${SECRET}x`, SECRET)).toBe(false);
		expect(autoriseCron(`Bearer ${SECRET.slice(0, -1)}`, SECRET)).toBe(false);
		expect(autoriseCron(`Bearer ${SECRET.toUpperCase()}`, SECRET)).toBe(false);
	});
});
