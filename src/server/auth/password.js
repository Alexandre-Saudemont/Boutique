import {randomBytes, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

/* Hachage des mots de passe.

   scrypt plutôt que bcrypt : il est dans Node, donc aucune dépendance à
   surveiller, et il résiste mieux aux attaques par matériel dédié (GPU, ASIC)
   parce qu'il exige de la mémoire en plus du calcul. bcrypt ne coûte que du CPU.

   Paramètres : N=2^16, r=8, p=1 — le profil recommandé par l'OWASP, environ
   64 Mo de mémoire par vérification. Assez lent pour décourager une attaque
   hors ligne, assez rapide pour une connexion (~100 ms).

   Format stocké : scrypt$N$r$p$sel$empreinte, tout en base64url. Les paramètres
   voyagent avec l'empreinte : le jour où on les durcit, les anciens mots de
   passe restent vérifiables et se remettent à niveau à la connexion suivante. */

const scryptAsync = promisify(scrypt);

const PARAMS = {N: 2 ** 16, r: 8, p: 1};
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password) {
	if (typeof password !== 'string' || password.length === 0) {
		throw new TypeError('Mot de passe manquant.');
	}

	const salt = randomBytes(SALT_LENGTH);
	const derived = await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
		...PARAMS,
		// scrypt refuse de tourner au-delà de 32 Mo sans relever cette limite.
		maxmem: 256 * 1024 * 1024,
	});

	return [
		'scrypt',
		PARAMS.N,
		PARAMS.r,
		PARAMS.p,
		salt.toString('base64url'),
		derived.toString('base64url'),
	].join('$');
}

export async function verifyPassword(password, stored) {
	if (typeof password !== 'string' || typeof stored !== 'string') return false;

	const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
	if (scheme !== 'scrypt') return false;

	const salt = Buffer.from(saltB64, 'base64url');
	const expected = Buffer.from(hashB64, 'base64url');

	const derived = await scryptAsync(password.normalize('NFKC'), salt, expected.length, {
		N: Number(n),
		r: Number(r),
		p: Number(p),
		maxmem: 256 * 1024 * 1024,
	});

	// Comparaison à temps constant : une comparaison classique s'arrête au premier
	// octet différent, ce qui laisse mesurer l'empreinte octet par octet.
	return timingSafeEqual(derived, expected);
}

/// Vrai si l'empreinte a été produite avec des paramètres plus faibles que les
/// paramètres courants — signal pour re-hacher au prochain login réussi.
export function needsRehash(stored) {
	const [scheme, n, r, p] = String(stored).split('$');
	if (scheme !== 'scrypt') return true;
	return Number(n) < PARAMS.N || Number(r) < PARAMS.r || Number(p) < PARAMS.p;
}
