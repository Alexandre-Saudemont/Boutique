import {describe, expect, it} from 'vitest';
import {ROLES_STAFF, aLeDroit, estStaff} from '@/server/auth/roles';

/* Contrôle d'accès du back-office.

   Ces tests décrivent le découpage des rôles convenu avec le client. Ils
   servent autant de documentation exécutable que de garde-fou : si quelqu'un
   ajoute demain un rôle au tableau des droits, il verra tout de suite ce qu'il
   vient d'ouvrir. */

const client = {role: 'CUSTOMER'};
const admin = {role: 'ADMIN'};
const preparateur = {role: 'STAFF_ORDERS'};
const serviceClient = {role: 'STAFF_SUPPORT'};

describe('estStaff', () => {
	it('reconnaît les trois rôles du back-office', () => {
		expect(estStaff(admin)).toBe(true);
		expect(estStaff(preparateur)).toBe(true);
		expect(estStaff(serviceClient)).toBe(true);
	});

	it('exclut le client et l’absence d’utilisateur', () => {
		expect(estStaff(client)).toBe(false);
		expect(estStaff(null)).toBe(false);
		expect(estStaff(undefined)).toBe(false);
	});

	it('n’a pas de rôle inattendu dans sa liste', () => {
		expect([...ROLES_STAFF].sort()).toEqual(['ADMIN', 'STAFF_ORDERS', 'STAFF_SUPPORT']);
	});
});

describe('aLeDroit', () => {
	it('donne tout à l’administrateur', () => {
		for (const droit of [
			'commandes.voir',
			'commandes.gerer',
			'produits.voir',
			'produits.gerer',
			'abonnes.voir',
			'reglages.gerer',
			'finances.voir',
		]) {
			expect(aLeDroit(admin, droit), droit).toBe(true);
		}
	});

	it('laisse le préparateur traiter les commandes et le stock', () => {
		expect(aLeDroit(preparateur, 'commandes.voir')).toBe(true);
		expect(aLeDroit(preparateur, 'commandes.gerer')).toBe(true);
		expect(aLeDroit(preparateur, 'produits.voir')).toBe(true);
	});

	it('interdit au préparateur les prix, les réglages et le chiffre d’affaires', () => {
		// C'est le cœur du découpage : voir les colis à faire partir, pas ce que
		// la boutique gagne.
		expect(aLeDroit(preparateur, 'produits.gerer')).toBe(false);
		expect(aLeDroit(preparateur, 'reglages.gerer')).toBe(false);
		expect(aLeDroit(preparateur, 'finances.voir')).toBe(false);
		expect(aLeDroit(preparateur, 'abonnes.voir')).toBe(false);
	});

	it('laisse le service client lire les commandes sans les modifier', () => {
		expect(aLeDroit(serviceClient, 'commandes.voir')).toBe(true);
		expect(aLeDroit(serviceClient, 'commandes.gerer')).toBe(false);
		expect(aLeDroit(serviceClient, 'produits.voir')).toBe(false);
	});

	it('ne donne aucun droit à un client', () => {
		expect(aLeDroit(client, 'commandes.voir')).toBe(false);
		expect(aLeDroit(client, 'produits.voir')).toBe(false);
	});

	it('refuse un droit inconnu plutôt que de l’accorder par défaut', () => {
		// Une faute de frappe dans un nom de droit ne doit jamais ouvrir la page :
		// elle doit la fermer.
		expect(aLeDroit(admin, 'commandes.gerrer')).toBe(false);
		expect(aLeDroit(admin, '')).toBe(false);
		expect(aLeDroit(admin, undefined)).toBe(false);
	});

	it('refuse tout à un utilisateur absent', () => {
		expect(aLeDroit(null, 'commandes.voir')).toBe(false);
	});
});
