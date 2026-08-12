import {describe, expect, it} from 'vitest';
import robots from '@/app/robots';

/* `robots.txt`.

   Ce fichier n'est pas une protection — les pages listées ici sont fermées
   côté serveur, et testées ailleurs. Ce qu'il empêche, c'est qu'un moteur
   affiche dans ses résultats une adresse de téléchargement ou une page de
   commande. La liste tient en dix lignes et se retire d'un geste distrait :
   d'où ce test.

   Le sitemap suit la règle inverse — il n'énumère que des pages publiques —
   mais il lit trois tables et vit donc du côté des tests d'intégration. */

const regle = () => robots().rules[0];

describe('robots.txt', () => {
	it('laisse la vitrine ouverte', () => {
		const {userAgent, allow} = regle();
		expect(userAgent).toBe('*');
		expect(allow).toBe('/');
	});

	/* Le plus important de la liste : un jeton de téléchargement indexé, c'est
	   l'ouvrage numérique d'un client servi à qui passe par là. */
	it('tient les moteurs à l’écart des liens de téléchargement', () => {
		expect(regle().disallow).toContain('/telechargement/');
	});

	it('tient les moteurs à l’écart des espaces privés et du back-office', () => {
		const {disallow} = regle();
		for (const chemin of ['/admin', '/api/', '/compte', '/panier', '/commande']) {
			expect(disallow).toContain(chemin);
		}
	});

	it('annonce le plan du site sur le même domaine que le site', () => {
		const {sitemap} = robots();
		expect(sitemap).toMatch(/^https?:\/\/[^/]+\/sitemap\.xml$/);
	});
});
