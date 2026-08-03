import 'server-only';
import {prisma} from '@/server/db';
import {hashPassword, needsRehash, verifyPassword} from '@/server/auth/password';

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

	// Aucun panier côté compte : le panier invité devient le sien, rien à
	// recopier.
	if (!panierCompte) {
		await prisma.cart.update({
			where: {id: panierInvite.id},
			data: {userId, sessionToken: null},
		});
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

/// Les commandes d'un compte, pour « Mes commandes ».
export async function getCommandesUtilisateur(userId) {
	return prisma.order.findMany({
		where: {userId},
		orderBy: {createdAt: 'desc'},
		include: {items: {select: {id: true, productName: true, quantity: true}}},
	});
}
