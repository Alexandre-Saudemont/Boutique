import 'server-only';
import {randomUUID} from 'node:crypto';
import {prisma} from '@/server/db';

/* Liste d'attente et lettre de l'antre.

   Tant que la boutique n'est pas ouverte, c'est la seule conversion du site :
   le visiteur ne peut rien acheter, il peut seulement laisser son adresse.

   Le RGPD demande de pouvoir prouver le consentement et de permettre le retrait
   à tout moment. D'où les trois dates du modèle — `consentAt` horodate
   l'inscription, `confirmedAt` le double opt-in, `unsubscribedAt` le retrait —
   et le `token`, qui fera le lien de désinscription en un clic sans exposer
   l'identifiant en base. */

/* Volontairement permissif : une regex stricte rejette des adresses valides
   (apostrophes, TLD longs) et n'empêche pas une adresse inventée. La vraie
   vérification, c'est le mail de confirmation qui arrive — ou pas. */
const FORME_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailValide(email) {
	return FORME_EMAIL.test(email);
}

/* Inscrit une adresse, ou réactive une inscription retirée.

   Une adresse déjà inscrite ne provoque pas d'erreur : on répond la même chose
   qu'à une nouvelle. Distinguer les deux cas à l'écran transformerait le
   formulaire en oracle — n'importe qui pourrait tester si une adresse est dans
   la liste du client. */
export async function subscribe(email, source = null) {
	const adresse = String(email ?? '')
		.trim()
		.toLowerCase();

	if (!emailValide(adresse)) {
		return {ok: false, erreur: 'Cette adresse e-mail ne semble pas valide.'};
	}

	await prisma.newsletterSubscriber.upsert({
		where: {email: adresse},
		// Une réinscription après désinscription : on efface le retrait et on
		// réhorodate le consentement, c'est lui qui fait foi.
		update: {unsubscribedAt: null, consentAt: new Date(), source},
		create: {email: adresse, source, token: randomUUID()},
	});

	return {ok: true};
}

/// Retire une adresse de la liste, depuis le lien du bas des e-mails.
export async function unsubscribeByToken(token) {
	const abonne = await prisma.newsletterSubscriber.findUnique({where: {token}});
	if (!abonne) return {ok: false};

	await prisma.newsletterSubscriber.update({
		where: {token},
		data: {unsubscribedAt: new Date()},
	});

	return {ok: true};
}
