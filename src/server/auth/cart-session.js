import 'server-only';
import {randomUUID} from 'node:crypto';
import {cookies} from 'next/headers';

/* Le jeton de panier invité.

   Un visiteur non connecté n'a pas d'identifiant : c'est ce cookie qui relie
   son navigateur à son panier en base. Il est `httpOnly` — aucun script de la
   page n'a besoin de le lire, et le rendre invisible au JavaScript retire une
   prise en cas d'injection.

   `sameSite: lax` laisse le cookie repartir quand le visiteur revient d'un lien
   externe (une newsletter, un moteur de recherche) tout en le retenant sur les
   requêtes croisées écrivantes.

   Le jeton n'est pas un identifiant de session au sens de l'authentification :
   il ne donne accès qu'à un panier. Les comptes auront leur propre mécanisme,
   signé et de durée bien plus courte. */

const NOM_COOKIE = 'panier';
const DUREE_SECONDES = 60 * 60 * 24 * 30; // trente jours, comme le panier en base

/// Le jeton du visiteur, ou `null` s'il n'en a pas encore.
export async function getCartToken() {
	const boite = await cookies();
	return boite.get(NOM_COOKIE)?.value ?? null;
}

/* Le jeton du visiteur, créé et posé s'il n'existe pas.

   À n'appeler que depuis une action serveur ou un gestionnaire de route : Next
   refuse d'écrire un cookie pendant le rendu d'une page, et pour une bonne
   raison — une page peut être mise en cache, pas un cookie. */
export async function ensureCartToken() {
	const boite = await cookies();
	const existant = boite.get(NOM_COOKIE)?.value;
	if (existant) return existant;

	const jeton = randomUUID();

	boite.set(NOM_COOKIE, jeton, {
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: DUREE_SECONDES,
	});

	return jeton;
}
