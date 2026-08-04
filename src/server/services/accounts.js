import 'server-only';
import {randomUUID} from 'node:crypto';
import {prisma} from '@/server/db';
import {hashPassword, needsRehash, verifyPassword} from '@/server/auth/password';
import {consommerJeton, creerJeton} from '@/server/auth/tokens';
import {envoyerLienReinitialisation, envoyerVerificationEmail} from '@/server/email/messages';

/* Comptes clients : inscription, connexion, profil.

   Deux principes traversent le fichier.

   **Ne jamais dire si une adresse est connue.** Ni à l'inscription, ni à la
   connexion, ni au mot de passe oublié. Un message qui distingue « adresse
   inconnue » de « mot de passe faux » transforme le formulaire en annuaire :
   on y teste des adresses jusqu'à savoir qui est client. Le message est donc
   toujours le même, et l'inscription sur une adresse déjà prise n'échoue pas —
   elle envoie un e-mail à l'ancien compte (à brancher avec l'envoi de mails).

   **Le mot de passe ne circule qu'une fois.** `hashPassword` le hache, plus
   rien ne le relit, et `passwordHash` n'est jamais remonté par les lectures. */

const LONGUEUR_MINIMALE = 10;

/* Dix caractères sans autre contrainte : les règles de composition
   (« une majuscule, un chiffre, un symbole ») produisent des mots de passe
   courts et prévisibles que les gens réutilisent. La longueur est ce qui
   protège vraiment. Recommandation ANSSI et NIST. */
export function validerMotDePasse(motDePasse) {
	const valeur = String(motDePasse ?? '');

	if (valeur.length < LONGUEUR_MINIMALE) {
		return {
			valide: false,
			erreur: `Le mot de passe doit faire au moins ${LONGUEUR_MINIMALE} caractères.`,
		};
	}

	return {valide: true};
}

function normaliserEmail(email) {
	return String(email ?? '')
		.trim()
		.toLowerCase();
}

function emailValide(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/* Crée un compte.

   Sur une adresse déjà prise, la fonction répond `ok` sans rien créer : c'est
   volontaire (voir l'en-tête). L'appelant affiche le même écran dans les deux
   cas — « vérifiez votre boîte mail » — et le titulaire du compte existant
   reçoit un avertissement plutôt qu'un nouveau compte. */
export async function inscrire({email, motDePasse, prenom, optInNewsletter = false}) {
	const adresse = normaliserEmail(email);

	if (!emailValide(adresse)) {
		return {ok: false, erreurs: {email: 'Cette adresse e-mail ne semble pas valide.'}};
	}

	const controle = validerMotDePasse(motDePasse);
	if (!controle.valide) {
		return {ok: false, erreurs: {motDePasse: controle.erreur}};
	}

	const existant = await prisma.user.findUnique({where: {email: adresse}});

	if (existant) {
		// À brancher : e-mail « quelqu'un a tenté de créer un compte avec votre
		// adresse ». Tant que l'envoi de mails n'existe pas, on s'arrête là.
		return {ok: true, cree: false, userId: null};
	}

	const utilisateur = await prisma.user.create({
		data: {
			email: adresse,
			passwordHash: await hashPassword(motDePasse),
			firstName: prenom ? String(prenom).trim() : null,
			// RGPD : on enregistre la date du consentement, pas un booléen — c'est
			// elle qui fait preuve.
			marketingOptIn: optInNewsletter ? new Date() : null,
		},
	});

	return {ok: true, cree: true, userId: utilisateur.id};
}

/* Vérifie les identifiants.

   Le hachage est recalculé même quand l'adresse est inconnue : sans ce leurre,
   une réponse immédiate trahirait qu'aucun compte n'existe, là où une adresse
   connue prendrait les ~100 ms de scrypt. */
let empreinteLeurre = null;

async function getEmpreinteLeurre() {
	// Calculée à la première connexion et gardée en mémoire : la faire au
	// chargement du module ajouterait 100 ms au démarrage du serveur pour une
	// valeur dont la plupart des requêtes n'ont pas besoin.
	empreinteLeurre ??= await hashPassword('mot-de-passe-qui-ne-sert-a-rien');
	return empreinteLeurre;
}

export async function connecter({email, motDePasse}) {
	const adresse = normaliserEmail(email);

	const utilisateur = await prisma.user.findUnique({where: {email: adresse}});

	if (!utilisateur?.passwordHash) {
		await verifyPassword(String(motDePasse ?? ''), await getEmpreinteLeurre());
		return {ok: false, erreur: 'Adresse e-mail ou mot de passe incorrect.'};
	}

	const correct = await verifyPassword(String(motDePasse ?? ''), utilisateur.passwordHash);

	if (!correct) {
		return {ok: false, erreur: 'Adresse e-mail ou mot de passe incorrect.'};
	}

	if (utilisateur.anonymizedAt) {
		return {ok: false, erreur: 'Adresse e-mail ou mot de passe incorrect.'};
	}

	/* Les paramètres de scrypt se durcissent avec le temps : une empreinte
	   produite avec les anciens se remet à niveau ici, pendant qu'on tient le
	   mot de passe en clair — la seule occasion de le faire. */
	if (needsRehash(utilisateur.passwordHash)) {
		await prisma.user.update({
			where: {id: utilisateur.id},
			data: {passwordHash: await hashPassword(motDePasse)},
		});
	}

	await prisma.user.update({
		where: {id: utilisateur.id},
		data: {lastLoginAt: new Date()},
	});

	return {ok: true, userId: utilisateur.id};
}

/* Demande de réinitialisation de mot de passe.

   La fonction répond toujours `ok`, que l'adresse soit connue ou non. C'est la
   même règle que partout ailleurs : un formulaire qui répond « adresse
   inconnue » se transforme en outil pour savoir qui est client.

   L'e-mail n'est donc envoyé que si le compte existe — et le visiteur voit dans
   les deux cas « si un compte existe, un lien vient de partir ». */
export async function demanderReinitialisation(email) {
	const adresse = normaliserEmail(email);

	const utilisateur = await prisma.user.findUnique({
		where: {email: adresse},
		select: {id: true, email: true, firstName: true, anonymizedAt: true, passwordHash: true},
	});

	/* Trois cas de silence : compte inexistant, compte anonymisé, et compte sans
	   mot de passe (connexion externe). Dans le dernier, envoyer un lien de
	   réinitialisation créerait un mot de passe là où il n'y en a jamais eu — ce
	   n'est pas ce que la personne attend. */
	if (!utilisateur || utilisateur.anonymizedAt || !utilisateur.passwordHash) {
		return {ok: true};
	}

	const jeton = await creerJeton(utilisateur.id, 'PASSWORD_RESET');
	await envoyerLienReinitialisation(utilisateur, jeton);

	return {ok: true};
}

/* Change le mot de passe à partir d'un jeton reçu par e-mail.

   Deux gestes en plus du changement lui-même, et ils comptent autant que lui.

   **Toutes les sessions sont fermées.** Quelqu'un réinitialise son mot de passe
   parce qu'il l'a oublié — ou parce qu'il soupçonne quelque chose. Dans le
   second cas, laisser ouvertes les sessions de l'intrus rendrait l'opération
   inutile.

   **L'adresse est marquée vérifiée.** La personne vient de prouver qu'elle
   accède à cette boîte mail : c'est exactement ce que la vérification atteste. */
export async function reinitialiserMotDePasse(jeton, nouveauMotDePasse) {
	const controle = validerMotDePasse(nouveauMotDePasse);
	if (!controle.valide) return {ok: false, erreur: controle.erreur};

	const userId = await consommerJeton(jeton, 'PASSWORD_RESET');

	if (!userId) {
		return {
			ok: false,
			erreur: 'Ce lien n’est plus valable. Demandez-en un nouveau, il ne coûte rien.',
		};
	}

	const empreinte = await hashPassword(nouveauMotDePasse);

	await prisma.$transaction([
		prisma.user.update({
			where: {id: userId},
			data: {passwordHash: empreinte, emailVerifiedAt: new Date()},
		}),
		prisma.session.deleteMany({where: {userId}}),
	]);

	return {ok: true};
}

/// Envoie (ou renvoie) le lien de vérification d'adresse. Silencieux sur un
/// compte déjà vérifié : le lien ne servirait à rien.
export async function demanderVerificationEmail(userId) {
	const utilisateur = await prisma.user.findUnique({
		where: {id: userId},
		select: {id: true, email: true, firstName: true, emailVerifiedAt: true},
	});

	if (!utilisateur || utilisateur.emailVerifiedAt) return {ok: true};

	const jeton = await creerJeton(utilisateur.id, 'EMAIL_VERIFY');
	await envoyerVerificationEmail(utilisateur, jeton);

	return {ok: true};
}

/// Marque l'adresse comme vérifiée à partir du jeton du lien.
export async function verifierEmail(jeton) {
	const userId = await consommerJeton(jeton, 'EMAIL_VERIFY');

	if (!userId) return {ok: false};

	await prisma.user.update({where: {id: userId}, data: {emailVerifiedAt: new Date()}});

	return {ok: true};
}

/* Rattache le panier invité au compte à la connexion.

   Sans cette étape, un visiteur qui remplit son panier puis se connecte le voit
   se vider — il a en réalité deux paniers, et le site vient de changer de
   lorgnette. Les deux sont fusionnés, en additionnant les quantités des
   variantes communes. */
export async function fusionnerPanier(sessionToken, userId) {
	if (!sessionToken) return;

	const panierInvite = await prisma.cart.findUnique({
		where: {sessionToken},
		include: {items: true},
	});

	if (!panierInvite || panierInvite.items.length === 0) return;

	const panierCompte = await prisma.cart.findUnique({where: {userId}});

	/* Aucun panier côté compte : le panier invité devient le sien, rien à
	   recopier.

	   Le `sessionToken` est conservé, et c'est essentiel : tout le reste du site
	   — l'affichage du panier, la pastille du header, la création de commande —
	   retrouve le panier par ce jeton, jamais par `userId`. L'effacer rendrait le
	   panier invisible juste après la connexion, au pire moment. */
	if (!panierCompte) {
		await prisma.cart.update({where: {id: panierInvite.id}, data: {userId}});
		return;
	}

	await prisma.$transaction(async (tx) => {
		for (const ligne of panierInvite.items) {
			const existante = await tx.cartItem.findUnique({
				where: {
					cartId_variantId: {cartId: panierCompte.id, variantId: ligne.variantId},
				},
			});

			await tx.cartItem.upsert({
				where: {
					cartId_variantId: {cartId: panierCompte.id, variantId: ligne.variantId},
				},
				update: {quantity: (existante?.quantity ?? 0) + ligne.quantity},
				create: {
					cartId: panierCompte.id,
					variantId: ligne.variantId,
					quantity: ligne.quantity,
				},
			});
		}

		await tx.cart.delete({where: {id: panierInvite.id}});

		/* Le jeton du cookie suit le panier conservé. Sans ce transfert, le
		   cookie du visiteur désignerait un panier qui vient d'être supprimé : il
		   verrait un panier vide alors que ses articles ont bien été fusionnés.

		   L'ordre compte — `sessionToken` est unique en base, il ne peut être
		   posé qu'après la suppression de la ligne qui le portait. */
		await tx.cart.update({where: {id: panierCompte.id}, data: {sessionToken}});
	});
}

/// Met à jour les informations du profil. L'e-mail n'est pas modifiable ici :
/// le changer demande de revérifier la nouvelle adresse, ce qui est un parcours
/// à part entière.
export async function mettreAJourProfil(userId, {prenom, nom, telephone, optInNewsletter}) {
	return prisma.user.update({
		where: {id: userId},
		data: {
			firstName: prenom ? String(prenom).trim() : null,
			lastName: nom ? String(nom).trim() : null,
			phone: telephone ? String(telephone).trim() : null,
			marketingOptIn: optInNewsletter ? new Date() : null,
		},
		select: {id: true},
	});
}

/* Droit à l'effacement (RGPD, art. 17).

   Le compte est **anonymisé**, pas supprimé, et il faut savoir pourquoi : les
   commandes passées sont des pièces comptables que la loi oblige à conserver
   dix ans. Supprimer la ligne du client emporterait ses factures avec elle.

   Ce qui disparaît : l'adresse e-mail, le nom, le téléphone, le mot de passe,
   les sessions, les jetons, le panier, la liste d'envies, les avis. Ce qui
   reste : les commandes et leurs adresses de livraison figées, parce qu'une
   facture doit rester lisible telle qu'elle a été émise.

   L'adresse est remplacée par une valeur unique et non réversible plutôt que
   vidée : la colonne est unique en base, et deux comptes anonymisés doivent
   pouvoir coexister.

   Le mot de passe est exigé pour lancer l'opération : c'est irréversible, et
   une session laissée ouverte sur un poste partagé ne doit pas suffire à
   effacer le compte de quelqu'un. */
export async function anonymiserCompte(userId, motDePasse) {
	const utilisateur = await prisma.user.findUnique({where: {id: userId}});

	if (!utilisateur || utilisateur.anonymizedAt) {
		return {ok: false, erreur: 'Compte introuvable.'};
	}

	if (!utilisateur.passwordHash || !(await verifyPassword(String(motDePasse ?? ''), utilisateur.passwordHash))) {
		return {ok: false, erreur: 'Mot de passe incorrect.'};
	}

	const marqueur = `anonyme-${randomUUID()}@supprime.invalid`;

	await prisma.$transaction([
		prisma.user.update({
			where: {id: userId},
			data: {
				email: marqueur,
				passwordHash: null,
				firstName: null,
				lastName: null,
				phone: null,
				marketingOptIn: null,
				emailVerifiedAt: null,
				anonymizedAt: new Date(),
			},
		}),
		prisma.session.deleteMany({where: {userId}}),
		prisma.verificationToken.deleteMany({where: {userId}}),
		prisma.address.deleteMany({where: {userId}}),
		prisma.wishlistItem.deleteMany({where: {userId}}),
		prisma.cart.deleteMany({where: {userId}}),
		/* Les avis sont détachés plutôt que supprimés : ils informent les autres
		   clients, et le texte n'appartient plus à personne une fois le lien
		   coupé. `authorName` est réécrit dans le même geste — il porte le prénom
		   affiché sous l'avis, et l'oublier laisserait le nom en vitrine. */
		prisma.review.updateMany({
			where: {userId},
			data: {userId: null, authorName: 'Client de l’antre'},
		}),
		/* Les droits de téléchargement partent aussi, par le compte **et** par
		   l'adresse — un achat fait en invité en porte une copie en clair.

		   Ils ne sont pas des pièces comptables, contrairement aux commandes : ce
		   sont des accès, au même titre qu'une session. Les garder laisserait une
		   adresse e-mail en base après un effacement, et surtout laisserait les
		   liens envoyés continuer de fonctionner pour un compte qui n'existe plus.
		   La commande, elle, reste et dit toujours ce qui a été acheté. */
		prisma.downloadGrant.deleteMany({
			where: {OR: [{userId}, {email: utilisateur.email}]},
		}),
		// La lettre d'information n'a plus de raison de partir à cette adresse.
		prisma.newsletterSubscriber.updateMany({
			where: {email: utilisateur.email},
			data: {unsubscribedAt: new Date()},
		}),
	]);

	return {ok: true};
}

/// Les commandes d'un compte, pour « Mes commandes ».
export async function getCommandesUtilisateur(userId) {
	return prisma.order.findMany({
		where: {userId},
		orderBy: {createdAt: 'desc'},
		include: {items: {select: {id: true, productName: true, quantity: true}}},
	});
}
