import {describe, expect, it} from 'vitest';
import {hashPassword, needsRehash, verifyPassword} from '@/server/auth/password';

/* Hachage des mots de passe.

   Ce que ces tests protègent : personne ne doit pouvoir remplacer scrypt par
   quelque chose de plus rapide sans que la suite proteste. C'est le genre de
   modification qui paraît anodine (« ça ralentit la connexion ») et qui rend
   toute la base de comptes cassable hors ligne. */

describe('hashPassword', () => {
	it('produit une empreinte au format scrypt paramétré', async () => {
		const empreinte = await hashPassword('un-mot-de-passe-correct');
		const [schema, n, r, p, sel, cle] = empreinte.split('$');

		expect(schema).toBe('scrypt');
		// Les paramètres OWASP : les voir baisser doit faire échouer le test.
		expect(Number(n)).toBeGreaterThanOrEqual(2 ** 16);
		expect(Number(r)).toBeGreaterThanOrEqual(8);
		expect(Number(p)).toBeGreaterThanOrEqual(1);
		expect(sel.length).toBeGreaterThan(0);
		expect(cle.length).toBeGreaterThan(0);
	});

	it('produit une empreinte différente à chaque appel, même mot de passe', async () => {
		// Deux comptes avec le même mot de passe ne doivent pas se reconnaître à
		// leur empreinte : c'est le rôle du sel aléatoire.
		const [a, b] = await Promise.all([hashPassword('identique'), hashPassword('identique')]);

		expect(a).not.toBe(b);
	});

	it('refuse un mot de passe vide ou absent', async () => {
		await expect(hashPassword('')).rejects.toThrow();
		await expect(hashPassword(undefined)).rejects.toThrow();
	});
});

describe('verifyPassword', () => {
	it('accepte le bon mot de passe', async () => {
		const empreinte = await hashPassword('correcte horse battery staple');

		await expect(verifyPassword('correcte horse battery staple', empreinte)).resolves.toBe(true);
	});

	it('refuse un mot de passe faux, même très proche', async () => {
		const empreinte = await hashPassword('mot-de-passe-solide');

		await expect(verifyPassword('mot-de-passe-solidE', empreinte)).resolves.toBe(false);
		await expect(verifyPassword('', empreinte)).resolves.toBe(false);
	});

	it('normalise les formes Unicode équivalentes', async () => {
		// « é » composé et « é » décomposé s'affichent pareil et se tapent
		// différemment selon le clavier. Sans NFKC, le client ne pourrait plus se
		// connecter depuis un autre appareil.
		const empreinte = await hashPassword('café-très-noir');

		await expect(verifyPassword('café-très-noir', empreinte)).resolves.toBe(true);
	});

	it('refuse une empreinte d’un autre schéma', async () => {
		// Une empreinte bcrypt importée d'ailleurs ne doit pas être acceptée en
		// silence : mieux vaut un refus qu'une vérification qui ne vérifie rien.
		await expect(verifyPassword('peu importe', '$2b$10$abcdefghijklmnop')).resolves.toBe(false);
	});

	it('ne lève pas sur une entrée qui n’est pas une chaîne', async () => {
		await expect(verifyPassword(null, 'scrypt$1$2$3$aa$bb')).resolves.toBe(false);
		await expect(verifyPassword('x', null)).resolves.toBe(false);
	});
});

describe('needsRehash', () => {
	it('demande une remise à niveau pour des paramètres plus faibles', () => {
		expect(needsRehash('scrypt$16384$8$1$sel$empreinte')).toBe(true);
	});

	it('laisse tranquille une empreinte aux paramètres courants', async () => {
		const empreinte = await hashPassword('à jour');

		expect(needsRehash(empreinte)).toBe(false);
	});

	it('demande une remise à niveau pour un schéma inconnu', () => {
		expect(needsRehash('$2b$10$abcdefghijklmnop')).toBe(true);
	});
});
