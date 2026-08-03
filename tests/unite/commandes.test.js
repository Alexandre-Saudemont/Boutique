import {describe, expect, it} from 'vitest';
import {LIBELLES_STATUT, statutsSuivants} from '@/server/services/orders';
import {validerAdresse} from '@/server/services/checkout';

/* Cycle de vie d'une commande et validation d'adresse.

   Les transitions sont la seule chose qui empêche une commande d'être marquée
   livrée sans être partie, ou expédiée sans être payée. */

describe('statutsSuivants', () => {
	it('ne laisse annuler qu’une commande impayée', () => {
		expect(statutsSuivants('PENDING_PAYMENT')).toEqual(['CANCELLED']);
	});

	it('fait avancer une commande payée vers la préparation', () => {
		expect(statutsSuivants('PAID')).toContain('PREPARING');
	});

	it('n’autorise jamais de sauter l’expédition', () => {
		expect(statutsSuivants('PAID')).not.toContain('SHIPPED');
		expect(statutsSuivants('PAID')).not.toContain('DELIVERED');
		expect(statutsSuivants('PREPARING')).not.toContain('DELIVERED');
	});

	it('ne permet plus rien après la livraison ou l’annulation', () => {
		expect(statutsSuivants('DELIVERED')).toEqual([]);
		expect(statutsSuivants('CANCELLED')).toEqual([]);
		expect(statutsSuivants('REFUNDED')).toEqual([]);
	});

	it('n’expose jamais le remboursement comme un geste manuel', () => {
		/* Le remboursement vient de Stripe, par le webhook. Un bouton
		   « rembourser » qui ne fait que changer un statut mentirait sur un
		   mouvement d'argent qui n'a pas eu lieu. */
		for (const statut of Object.keys(LIBELLES_STATUT)) {
			expect(statutsSuivants(statut), statut).not.toContain('REFUNDED');
		}
	});

	it('ne permet plus d’annuler une commande déjà expédiée', () => {
		expect(statutsSuivants('SHIPPED')).toEqual(['DELIVERED']);
	});

	it('rend une liste vide sur un statut inconnu', () => {
		expect(statutsSuivants('N_IMPORTE_QUOI')).toEqual([]);
		expect(statutsSuivants(undefined)).toEqual([]);
	});

	it('a un libellé français pour chaque statut', () => {
		for (const [statut, libelle] of Object.entries(LIBELLES_STATUT)) {
			expect(libelle, statut).toBeTruthy();
		}
	});
});

describe('validerAdresse', () => {
	const adresse = {
		firstName: 'Camille',
		lastName: 'Durand',
		line1: '12 rue des Lilas',
		postalCode: '69003',
		city: 'Lyon',
		email: 'camille@exemple.fr',
	};

	it('accepte une adresse complète', () => {
		expect(validerAdresse(adresse).valide).toBe(true);
	});

	it('signale chaque champ manquant séparément', () => {
		const controle = validerAdresse({...adresse, firstName: '', city: '   '});

		expect(controle.valide).toBe(false);
		expect(controle.erreurs.firstName).toBeTruthy();
		expect(controle.erreurs.city).toBeTruthy();
		expect(controle.erreurs.lastName).toBeUndefined();
	});

	it('exige cinq chiffres pour le code postal', () => {
		expect(validerAdresse({...adresse, postalCode: '6900'}).valide).toBe(false);
		expect(validerAdresse({...adresse, postalCode: '69 003'}).valide).toBe(false);
		expect(validerAdresse({...adresse, postalCode: 'LYON3'}).valide).toBe(false);
	});

	it('exige une adresse e-mail plausible — c’est le seul moyen de suivi', () => {
		expect(validerAdresse({...adresse, email: 'camille'}).valide).toBe(false);
		expect(validerAdresse({...adresse, email: ''}).valide).toBe(false);
		expect(validerAdresse({...adresse, email: 'camille@exemple'}).valide).toBe(false);
	});

	it('n’impose rien sur le complément d’adresse ni le téléphone', () => {
		expect(validerAdresse({...adresse, line2: '', phone: ''}).valide).toBe(true);
	});
});
