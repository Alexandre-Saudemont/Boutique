import {describe, expect, it} from 'vitest';
import {prixEnCentimes, urlImageAcceptable, validerProduit} from '@/server/services/product-admin';
import {slugifier} from '@/lib/slug';

/* Saisie du catalogue : conversion des prix, adresses d'images, validation.

   Le test le plus important du fichier est celui des adresses internes : c'est
   le garde-fou contre le relais de requêtes via l'optimiseur d'images. */

describe('prixEnCentimes', () => {
	it('accepte la virgule française comme le point', () => {
		expect(prixEnCentimes('74,90')).toBe(7490);
		expect(prixEnCentimes('74.90')).toBe(7490);
	});

	it('accepte un entier et les espaces de frappe', () => {
		expect(prixEnCentimes('74')).toBe(7400);
		expect(prixEnCentimes(' 74,90 ')).toBe(7490);
	});

	it('ne perd pas de centime sur les valeurs piégeuses', () => {
		// 0,1 + 0,2 en flottant donne 0,30000000000000004 : c'est exactement ce
		// que la conversion en entier doit effacer.
		expect(prixEnCentimes('0,30')).toBe(30);
		expect(prixEnCentimes('19,99')).toBe(1999);
		expect(prixEnCentimes('1000,01')).toBe(100001);
	});

	it('refuse ce qui n’est pas un montant', () => {
		for (const saisie of ['', 'gratuit', '-5', '74,905', '1e3', null, undefined, '12,']) {
			expect(prixEnCentimes(saisie), String(saisie)).toBeNull();
		}
	});
});

describe('urlImageAcceptable', () => {
	it('accepte une adresse https publique', () => {
		expect(urlImageAcceptable('https://images.exemple.fr/figurine.jpg')).toBe(true);
	});

	it('refuse tout ce qui n’est pas https', () => {
		expect(urlImageAcceptable('http://images.exemple.fr/a.jpg')).toBe(false);
		expect(urlImageAcceptable('data:image/png;base64,AAAA')).toBe(false);
		expect(urlImageAcceptable('javascript:alert(1)')).toBe(false);
		expect(urlImageAcceptable('file:///etc/passwd')).toBe(false);
	});

	it('refuse les adresses du réseau interne', () => {
		/* Le cas qui compte : l'optimiseur d'images va chercher l'URL depuis le
		   serveur. Une adresse interne en ferait un relais vers le réseau privé de
		   l'hébergeur — dont le service de métadonnées 169.254.169.254, qui
		   distribue des identifiants d'accès chez la plupart des hébergeurs. */
		for (const adresse of [
			'https://localhost/a.jpg',
			'https://127.0.0.1/a.jpg',
			'https://10.0.0.5/a.jpg',
			'https://192.168.1.20/a.jpg',
			'https://169.254.169.254/latest/meta-data/',
			'https://172.16.0.1/a.jpg',
			'https://172.31.255.254/a.jpg',
		]) {
			expect(urlImageAcceptable(adresse), adresse).toBe(false);
		}
	});

	it('n’exclut pas les adresses publiques qui leur ressemblent', () => {
		// 172.32 est public, contrairement à 172.16–172.31 : la plage privée ne
		// doit pas être élargie par une regex trop gourmande.
		expect(urlImageAcceptable('https://172.32.0.1/a.jpg')).toBe(true);
		expect(urlImageAcceptable('https://101.0.0.1/a.jpg')).toBe(true);
	});

	it('refuse une adresse illisible', () => {
		expect(urlImageAcceptable('pas une url')).toBe(false);
		expect(urlImageAcceptable('')).toBe(false);
	});
});

describe('validerProduit', () => {
	const valide = {
		nom: 'Rônin des Cerisiers',
		publication: 'BROUILLON',
		variantes: [{prix: '74,90', stock: '2'}],
		images: [],
	};

	it('accepte une saisie correcte', () => {
		expect(validerProduit(valide).valide).toBe(true);
	});

	it('exige un nom', () => {
		const controle = validerProduit({...valide, nom: '   '});

		expect(controle.valide).toBe(false);
		expect(controle.erreurs.nom).toBeTruthy();
	});

	it('exige au moins une variante — c’est elle qui porte le prix', () => {
		expect(validerProduit({...valide, variantes: []}).valide).toBe(false);
	});

	it('signale la variante fautive par son rang', () => {
		const controle = validerProduit({
			...valide,
			variantes: [{prix: '10,00', stock: '1'}, {prix: 'offert', stock: '1'}],
		});

		expect(controle.valide).toBe(false);
		expect(controle.erreurs['variante.1.prix']).toBeTruthy();
		expect(controle.erreurs['variante.0.prix']).toBeUndefined();
	});

	it('refuse un stock qui n’est pas un entier', () => {
		expect(validerProduit({...valide, variantes: [{prix: '10', stock: '2,5'}]}).valide).toBe(
			false,
		);
		expect(validerProduit({...valide, variantes: [{prix: '10', stock: '-1'}]}).valide).toBe(false);
	});

	it('refuse un type ou un état hors de l’énumération', () => {
		expect(validerProduit({...valide, kind: 'MAGIQUE'}).valide).toBe(false);
		expect(validerProduit({...valide, condition: 'CASSE'}).valide).toBe(false);
	});

	it('refuse une image dont l’adresse ne convient pas', () => {
		const controle = validerProduit({
			...valide,
			images: [{url: 'http://exemple.fr/a.jpg'}],
		});

		expect(controle.valide).toBe(false);
		expect(controle.erreurs['image.0']).toBeTruthy();
	});
});

describe('slugifier', () => {
	it('retire les accents et met en minuscules', () => {
		expect(slugifier('Épée Légendaire')).toBe('epee-legendaire');
	});

	it('remplace tout ce qui n’est ni lettre ni chiffre', () => {
		expect(slugifier('Rônin — 1/7 (édition limitée)')).toBe('ronin-1-7-edition-limitee');
	});

	it('ne laisse jamais de tiret au bord', () => {
		expect(slugifier('  ??? Bonjour !!!  ')).toBe('bonjour');
	});

	it('borne la longueur', () => {
		expect(slugifier('a'.repeat(200)).length).toBeLessThanOrEqual(80);
	});

	it('rend une chaîne vide sur une saisie sans caractère utilisable', () => {
		expect(slugifier('???')).toBe('');
		expect(slugifier(null)).toBe('');
	});
});
