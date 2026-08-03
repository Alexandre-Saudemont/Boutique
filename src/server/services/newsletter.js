import 'server-only';
import {randomUUID} from 'node:crypto';
import {prisma} from '@/server/db';
import {envoyerConfirmationNewsletter} from '@/server/email/messages';

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

	const abonne = await prisma.newsletterSubscriber.upsert({
		where: {email: adresse},
		// Une réinscription après désinscription : on efface le retrait et on
		// réhorodate le consentement, c'est lui qui fait foi.
		update: {unsubscribedAt: null, consentAt: new Date(), source},
		create: {email: adresse, source, token: randomUUID()},
	});

	/* Double opt-in : tant que le lien reçu par e-mail n'a pas été suivi,
	   l'inscription n'est pas confirmée et l'adresse ne recevra aucune lettre.

	   Deux raisons, et la seconde compte autant que la première. D'abord le
	   RGPD : sans confirmation, rien ne prouve que le titulaire de l'adresse a
	   consenti. Ensuite le respect élémentaire — sans cette étape, n'importe qui
	   peut inscrire l'adresse de quelqu'un d'autre, et c'est le Vieux geek qui
	   passe pour un spammeur.

	   Une adresse déjà confirmée ne reçoit pas de second message : ce serait le
	   moyen le plus simple de la harceler depuis le formulaire public. */
	if (!abonne.confirmedAt) {
		await envoyerConfirmationNewsletter(abonne);
	}

	return {ok: true};
}

/* Confirme une inscription à partir du jeton reçu par e-mail.

   Le jeton est un UUID tiré au hasard : il ne se devine pas et n'apprend rien
   sur l'adresse qu'il désigne. C'est aussi lui qui sert à la désinscription —
   un seul lien à faire figurer dans les messages. */
export async function confirmerInscription(token) {
	if (!token) return {ok: false};

	const abonne = await prisma.newsletterSubscriber.findUnique({where: {token}});
	if (!abonne) return {ok: false};

	// Déjà confirmé : on répond que tout va bien. Cliquer deux fois sur le même
	// lien ne doit pas ressembler à une erreur.
	if (abonne.confirmedAt) return {ok: true, email: abonne.email};

	await prisma.newsletterSubscriber.update({
		where: {token},
		data: {confirmedAt: new Date(), unsubscribedAt: null},
	});

	return {ok: true, email: abonne.email};
}

/// Les adresses à qui une lettre peut légitimement être envoyée : confirmées et
/// non désinscrites. C'est cette liste qui fera foi le jour d'un envoi.
export async function listerDestinataires() {
	return prisma.newsletterSubscriber.findMany({
		where: {confirmedAt: {not: null}, unsubscribedAt: null},
		select: {email: true, token: true},
	});
}

/// La liste, pour le back-office. Les désinscrits restent consultables : la
/// preuve du retrait fait partie de ce que le RGPD demande de pouvoir montrer.
export async function listerAbonnes({inclureDesinscrits = false} = {}) {
	return prisma.newsletterSubscriber.findMany({
		where: inclureDesinscrits ? {} : {unsubscribedAt: null},
		orderBy: {consentAt: 'desc'},
		take: 500,
		select: {
			id: true,
			email: true,
			consentAt: true,
			confirmedAt: true,
			unsubscribedAt: true,
			source: true,
		},
	});
}

/// Retrait déclenché depuis le back-office — un client qui écrit « retirez-moi »
/// plutôt que de cliquer sur le lien. Même effet que la désinscription en ligne.
export async function desinscrireAbonne(id) {
	await prisma.newsletterSubscriber.update({
		where: {id},
		data: {unsubscribedAt: new Date()},
	});

	return {ok: true};
}

/* Échappe une cellule pour un fichier CSV.

   Deux problèmes distincts. Le premier est le format : guillemets doublés,
   cellule entourée dès qu'elle contient un séparateur ou un retour à la ligne.

   Le second est une faille connue des tableurs : une cellule commençant par
   `=`, `+`, `-` ou `@` est interprétée comme une formule à l'ouverture. Une
   adresse e-mail forgée à l'inscription pourrait ainsi exécuter quelque chose
   sur le poste de qui ouvre l'export. On préfixe donc ces cellules d'une
   apostrophe, qui force le tableur à les lire comme du texte. */
function celluleCsv(valeur) {
	const texte = String(valeur ?? '');
	const sur = /^[=+\-@]/.test(texte) ? `'${texte}` : texte;

	return /[",;\n]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur;
}

/* L'export de la liste, au format CSV.

   Séparateur point-virgule et BOM UTF-8 en tête : c'est ce qu'attend Excel en
   configuration française. Sans le BOM, les accents s'affichent en charabia ;
   avec une virgule, tout atterrit dans une seule colonne. */
export async function abonnesEnCsv() {
	const abonnes = await listerAbonnes({inclureDesinscrits: true});

	const lignes = [
		['E-mail', 'Consentement', 'Confirmé le', 'Désinscrit le', 'Source'],
		...abonnes.map((abonne) => [
			abonne.email,
			abonne.consentAt.toISOString(),
			abonne.confirmedAt?.toISOString() ?? '',
			abonne.unsubscribedAt?.toISOString() ?? '',
			abonne.source ?? '',
		]),
	];

	return `﻿${lignes.map((ligne) => ligne.map(celluleCsv).join(';')).join('\r\n')}`;
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
