'use server';

import {redirect} from 'next/navigation';
import {headers} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {
	connecter,
	fusionnerPanier,
	inscrire,
	mettreAJourProfil,
} from '@/server/services/accounts';
import {
	creerSession,
	fermerSession,
	getUtilisateurCourant,
} from '@/server/auth/session';
import {getCartToken} from '@/server/auth/cart-session';
import {reinitialiserLimite, verifierLimite} from '@/server/auth/rate-limit';

/* Actions du compte client.

   La connexion et l'inscription enchaînent trois choses dans cet ordre :
   vérifier, ouvrir la session, fusionner le panier invité. La fusion vient en
   dernier parce qu'elle est réparable — un panier mal fusionné se recharge, une
   session ouverte à tort ne se rattrape pas. */

async function ouvrirSessionEtFusionner(userId) {
	await creerSession(userId);

	const jetonPanier = await getCartToken();
	await fusionnerPanier(jetonPanier, userId);

	// Le header porte la pastille du panier et l'état de connexion.
	revalidatePath('/', 'layout');
}

export async function seConnecter(_precedent, donnees) {
	const email = donnees.get('email');
	const cle = `connexion:${String(email ?? '').trim().toLowerCase()}`;

	/* La limite porte sur l'adresse visée, pas sur l'IP : c'est le compte qu'on
	   protège. Dix essais par quart d'heure laissent largement la place aux
	   fautes de frappe et rendent l'essai systématique inopérant. */
	const limite = verifierLimite(cle, {max: 10, fenetreMs: 15 * 60 * 1000});

	if (!limite.autorise) {
		const minutes = Math.ceil(limite.resteSecondes / 60);

		return {
			statut: 'erreur',
			message: `Trop de tentatives. Réessayez dans ${minutes} minute${
				minutes > 1 ? 's' : ''
			}.`,
			email: String(email ?? ''),
		};
	}

	const resultat = await connecter({email, motDePasse: donnees.get('motDePasse')});

	if (!resultat.ok) {
		// L'adresse repart avec l'erreur, jamais le mot de passe : le champ se
		// vide, et c'est très bien.
		return {statut: 'erreur', message: resultat.erreur, email: String(email ?? '')};
	}

	// Connexion réussie : le compteur repart de zéro, sinon quelqu'un qui s'est
	// trompé neuf fois resterait à une tentative de la porte close.
	reinitialiserLimite(cle);

	await ouvrirSessionEtFusionner(resultat.userId);

	redirect('/compte');
}

export async function sInscrire(_precedent, donnees) {
	const email = donnees.get('email');

	/* L'inscription est limitée par origine, pas par adresse : ce qu'on freine
	   ici, c'est la création de comptes en série, et l'attaquant change
	   d'adresse à chaque essai. `x-forwarded-for` n'est fiable que derrière un
	   proxy de confiance — c'est le cas en production (Vercel, ou un Nginx qui
	   la réécrit). En développement, tout le monde partage la même valeur, ce
	   qui n'a pas d'importance. */
	const enTetes = await headers();
	const origine = enTetes.get('x-forwarded-for')?.split(',')[0]?.trim() || 'inconnue';

	const limite = verifierLimite(`inscription:${origine}`, {
		max: 5,
		fenetreMs: 60 * 60 * 1000,
	});

	if (!limite.autorise) {
		return {
			statut: 'erreur',
			erreurs: {email: 'Trop de créations de compte. Réessayez dans une heure.'},
			email: String(email ?? ''),
			prenom: String(donnees.get('prenom') ?? ''),
		};
	}

	const resultat = await inscrire({
		email,
		motDePasse: donnees.get('motDePasse'),
		prenom: donnees.get('prenom'),
		optInNewsletter: donnees.get('newsletter') === 'on',
	});

	if (!resultat.ok) {
		return {
			statut: 'erreur',
			erreurs: resultat.erreurs,
			email: String(email ?? ''),
			prenom: String(donnees.get('prenom') ?? ''),
		};
	}

	/* Adresse déjà prise : le service n'a rien créé et ne le dit pas. On ne
	   connecte donc personne, et l'écran affiche le même message que pour une
	   inscription réussie. */
	if (!resultat.cree) {
		return {statut: 'a-verifier'};
	}

	await ouvrirSessionEtFusionner(resultat.userId);

	redirect('/compte');
}

export async function seDeconnecter() {
	await fermerSession();
	revalidatePath('/', 'layout');
	redirect('/');
}

export async function enregistrerProfil(_precedent, donnees) {
	const utilisateur = await getUtilisateurCourant();

	if (!utilisateur) {
		return {statut: 'erreur', message: 'Votre session a expiré. Reconnectez-vous.'};
	}

	await mettreAJourProfil(utilisateur.id, {
		prenom: donnees.get('prenom'),
		nom: donnees.get('nom'),
		telephone: donnees.get('telephone'),
		optInNewsletter: donnees.get('newsletter') === 'on',
	});

	revalidatePath('/compte');

	return {statut: 'enregistre'};
}
