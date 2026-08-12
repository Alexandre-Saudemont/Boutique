'use server';

import {redirect} from 'next/navigation';
import {headers} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {
	anonymiserCompte,
	changerMotDePasse,
	connecter,
	demanderReinitialisation,
	demanderVerificationEmail,
	fusionnerPanier,
	inscrire,
	mettreAJourProfil,
	reinitialiserMotDePasse,
} from '@/server/services/accounts';
import {
	creerSession,
	fermerSession,
	getJetonSession,
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

	/* Retour à la page qui a demandé la connexion, si elle en a passé une. Le
	   filtre sur le chemin est refait ici : le champ caché vient du navigateur,
	   et une redirection est exactement ce qu'on ne laisse pas choisir au
	   client — un `//exemple.com` glissé dans le formulaire enverrait le visiteur
	   ailleurs juste après sa saisie de mot de passe. */
	const suite = String(donnees.get('suite') ?? '');

	redirect(/^\/(?!\/)/.test(suite) ? suite : '/compte');
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

	/* Le lien de vérification part maintenant que le compte existe. Il ne bloque
	   rien : le client peut commander sans avoir cliqué. Exiger la vérification
	   avant tout achat ferait perdre des ventes pour un gain de sécurité mince —
	   c'est le paiement qui atteste sérieusement de l'identité, pas une boîte
	   mail. */
	await demanderVerificationEmail(resultat.userId);

	redirect('/compte');
}

/* Demande d'un lien de réinitialisation.

   Deux limites, pour deux abus différents. Par adresse : sans elle, ce
   formulaire sert à inonder la boîte mail de quelqu'un — trois messages par
   quart d'heure suffisent largement à un usage honnête. La réponse est toujours
   la même, y compris quand la limite est atteinte : dire « trop de demandes sur
   cette adresse » révélerait qu'elle est connue. */
export async function demanderNouveauMotDePasse(_precedent, donnees) {
	const email = String(donnees.get('email') ?? '')
		.trim()
		.toLowerCase();

	const limite = verifierLimite(`reinit:${email}`, {max: 3, fenetreMs: 15 * 60 * 1000});

	if (limite.autorise) {
		await demanderReinitialisation(email);
	}

	// Réponse unique, quoi qu'il arrive : compte inexistant, limite atteinte ou
	// e-mail parti, le visiteur lit exactement la même phrase.
	return {statut: 'envoye'};
}

/* Choix du nouveau mot de passe.

   Le jeton n'est pas revalidé ici : `reinitialiserMotDePasse` le consomme dans
   une transaction, ce qui est le seul endroit où la vérification et l'usage ne
   peuvent pas être dissociés. */
export async function choisirNouveauMotDePasse(_precedent, donnees) {
	const jeton = String(donnees.get('jeton') ?? '');
	const motDePasse = donnees.get('motDePasse');

	if (motDePasse !== donnees.get('confirmation')) {
		return {statut: 'erreur', message: 'Les deux mots de passe ne sont pas identiques.'};
	}

	const resultat = await reinitialiserMotDePasse(jeton, motDePasse);

	if (!resultat.ok) return {statut: 'erreur', message: resultat.erreur};

	/* Toutes les sessions ont été fermées, y compris celle en cours si la
	   personne était connectée : elle se reconnecte avec son nouveau mot de
	   passe, ce qui confirme au passage qu'il fonctionne. */
	redirect('/compte?motdepasse=change');
}

/* Suppression du compte.

   Le mot de passe est redemandé : l'opération est irréversible, et une session
   laissée ouverte sur un poste partagé ne doit pas suffire à effacer le compte
   de quelqu'un.

   La session est fermée juste après — le compte n'existe plus sous cette
   identité, y rester connecté n'aurait aucun sens. */
export async function supprimerMonCompte(_precedent, donnees) {
	const utilisateur = await getUtilisateurCourant();

	if (!utilisateur) redirect('/compte');

	const resultat = await anonymiserCompte(utilisateur.id, donnees.get('motDePasse'));

	if (!resultat.ok) return {statut: 'erreur', message: resultat.erreur};

	await fermerSession();
	revalidatePath('/', 'layout');

	redirect('/?compte=supprime');
}

/* Changement de mot de passe depuis son compte.

   Limité, comme la connexion : le formulaire vérifie un mot de passe, il est
   donc utilisable pour en essayer. La limite porte sur le compte connecté et
   non sur l'adresse saisie — il n'y en a pas — ce qui la rend inoffensive pour
   les autres : personne ne peut bloquer le formulaire de quelqu'un d'autre.

   La limite est remise à zéro au succès. Sans ça, changer son mot de passe deux
   fois de suite dans la même journée finirait par se heurter au compteur, alors
   que rien d'anormal ne s'est produit. */
export async function changerMonMotDePasse(_precedent, donnees) {
	const utilisateur = await getUtilisateurCourant();

	if (!utilisateur) {
		return {statut: 'erreur', message: 'Votre session a expiré. Reconnectez-vous.'};
	}

	if (donnees.get('nouveau') !== donnees.get('confirmation')) {
		return {statut: 'erreur', message: 'Les deux mots de passe ne sont pas identiques.'};
	}

	const cle = `motdepasse:${utilisateur.id}`;
	const limite = verifierLimite(cle, {max: 10, fenetreMs: 15 * 60 * 1000});

	if (!limite.autorise) {
		const minutes = Math.ceil(limite.resteSecondes / 60);

		return {
			statut: 'erreur',
			message: `Trop de tentatives. Réessayez dans ${minutes} minute${
				minutes > 1 ? 's' : ''
			}.`,
		};
	}

	const resultat = await changerMotDePasse(utilisateur.id, {
		actuel: donnees.get('actuel'),
		nouveau: donnees.get('nouveau'),
		jetonAConserver: await getJetonSession(),
	});

	if (!resultat.ok) return {statut: 'erreur', message: resultat.erreur};

	reinitialiserLimite(cle);

	return {statut: 'motdepasse-change'};
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
