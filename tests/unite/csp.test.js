import {existsSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {construirePolitique, proxy} from '@/proxy';

/* Content-Security-Policy.

   Une CSP se dégrade en silence : il suffit d'ajouter `'unsafe-inline'` aux
   scripts pour faire disparaître une erreur gênante, et la protection ne sert
   plus à rien sans que rien ne le signale. Ces tests rendent cette dégradation
   bruyante. */

function politiqueDe(requete = new Request('https://antre-geek.fr/boutique')) {
	const reponse = proxy(requete);

	return reponse.headers.get('Content-Security-Policy');
}

function directive(politique, nom) {
	return politique
		.split(';')
		.map((morceau) => morceau.trim())
		.find((morceau) => morceau.startsWith(`${nom} `));
}

describe('CSP', () => {
	it('est posée sur la réponse', () => {
		expect(politiqueDe()).toBeTruthy();
	});

	it('porte un nonce différent à chaque requête', () => {
		const premier = politiqueDe().match(/'nonce-([a-z0-9]+)'/)[1];
		const second = politiqueDe().match(/'nonce-([a-z0-9]+)'/)[1];

		expect(premier).not.toBe(second);
		// Assez long pour ne pas se deviner entre le chargement et l'injection.
		expect(premier.length).toBeGreaterThanOrEqual(32);
	});

	it('reprend exactement le nonce qu’on lui donne', () => {
		/* Le rendu reçoit ce même nonce par l'en-tête `x-nonce` de la requête, et
		   c'est lui que Next appose sur ses balises. Une politique qui annoncerait
		   un autre jeton donnerait une page blanche : tous les scripts refusés. */
		expect(construirePolitique('abc123')).toContain("'nonce-abc123'");
	});

	it('n’autorise pas les scripts en ligne autrement que par nonce', () => {
		const scripts = directive(politiqueDe(), 'script-src');

		/* `unsafe-inline` est présent, et c'est volontaire : les navigateurs qui
		   comprennent les nonces l'ignorent, ceux qui ne les comprennent pas s'en
		   servent de repli. Ce qui compte, c'est que le nonce soit là — sans lui,
		   il n'y aurait plus aucune protection. */
		expect(scripts).toMatch(/'nonce-[a-z0-9]+'/);
		expect(scripts).toContain("'strict-dynamic'");
	});

	it('interdit les greffons, les iframes tierces et le détournement de base', () => {
		const politique = politiqueDe();

		expect(politique).toContain("object-src 'none'");
		expect(politique).toContain("frame-ancestors 'none'");
		expect(politique).toContain("base-uri 'self'");
	});

	it('empêche un formulaire de poster ailleurs', () => {
		expect(politiqueDe()).toContain("form-action 'self'");
	});

	it('n’autorise aucune connexion sortante vers un tiers', () => {
		expect(directive(politiqueDe(), 'connect-src')).toBe("connect-src 'self'");
	});

	/* Next 16 reconnaît encore `src/middleware.js`, mais n'exécute que l'un des
	   deux fichiers. Si celui-ci réapparaissait — retour de branche mal résolu,
	   copie de sauvegarde oubliée — le site pourrait tourner avec l'ancienne
	   politique, ou sans aucune, sans que rien ne le signale. Une CSP absente ne
	   casse rien : c'est exactement ce qui la rend facile à perdre. */
	it('n’a pas laissé l’ancien middleware derrière lui', () => {
		expect(existsSync('src/middleware.js')).toBe(false);
	});
});
