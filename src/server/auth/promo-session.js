import 'server-only';
import {cookies} from 'next/headers';

/* Le code de réduction en cours de saisie.

   Il vit dans un cookie parce qu'il appartient à une intention d'achat, pas à
   un compte : un visiteur non connecté doit pouvoir saisir son code au panier
   et le retrouver au paiement.

   Le cookie ne porte que le code lui-même, jamais le montant de la réduction :
   celui-ci est recalculé à chaque affichage, contre la base. Un code désactivé
   entre-temps, expiré ou dont le quota vient d'être atteint cesse de s'appliquer
   immédiatement — même s'il traîne encore dans le navigateur.

   Durée courte : le temps d'un achat, pas d'une saison. Un code oublié dans un
   cookie qui ressort trois semaines plus tard sur un autre panier serait une
   mauvaise surprise, dans un sens comme dans l'autre. */

const NOM_COOKIE = 'promo';
const DUREE_SECONDES = 60 * 60 * 24; // vingt-quatre heures

export async function getCodePromo() {
	const boite = await cookies();

	return boite.get(NOM_COOKIE)?.value ?? null;
}

export async function setCodePromo(code) {
	const boite = await cookies();

	boite.set(NOM_COOKIE, String(code).trim().toUpperCase(), {
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: DUREE_SECONDES,
	});
}

export async function effacerCodePromo() {
	const boite = await cookies();

	boite.delete(NOM_COOKIE);
}
