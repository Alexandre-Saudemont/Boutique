import 'server-only';
import {randomBytes} from 'node:crypto';
import {cookies, headers} from 'next/headers';
import {prisma} from '@/server/db';

/* Sessions de connexion.

   Le cookie ne porte qu'un jeton aléatoire ; l'identité vit en base. C'est ce
   qui permet de révoquer une session immédiatement — déconnexion, compte
   compromis, « déconnecter tous mes appareils » — là où un jeton auto-porté
   (JWT) reste valable jusqu'à son expiration quoi qu'on fasse.

   Le jeton fait 32 octets tirés de `randomBytes` : il n'est ni deviné ni
   énuméré. Il n'encode rien, ce n'est qu'une clé de recherche.

   Durée : trente jours, prolongés à chaque visite. Un client qui commande une
   fois par mois ne doit pas retaper son mot de passe à chaque fois, et la
   révocation en base couvre ce que la durée courte protégeait. */

const NOM_COOKIE = 'session';
const DUREE_JOURS = 30;

/* En dessous de cette part de vie restante, la session est prolongée. Sans ce
   seuil, chaque page vue provoquerait une écriture en base pour repousser
   l'échéance de quelques secondes. */
const SEUIL_PROLONGATION = 0.5;

function dateExpiration() {
	const date = new Date();
	date.setDate(date.getDate() + DUREE_JOURS);
	return date;
}

/// Ouvre une session et pose le cookie. À n'appeler que depuis une action
/// serveur ou un gestionnaire de route.
export async function creerSession(userId) {
	const jeton = randomBytes(32).toString('base64url');
	const enTetes = await headers();

	await prisma.session.create({
		data: {
			userId,
			token: jeton,
			// Sert à l'utilisateur pour reconnaître ses appareils dans « mes
			// sessions ». Tronqué : au-delà, c'est du bruit.
			userAgent: enTetes.get('user-agent')?.slice(0, 255) ?? null,
			expiresAt: dateExpiration(),
		},
	});

	const boite = await cookies();

	boite.set(NOM_COOKIE, jeton, {
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: DUREE_JOURS * 24 * 60 * 60,
	});

	return jeton;
}

/* L'utilisateur connecté, ou `null`.

   Une session expirée est supprimée au passage plutôt que simplement ignorée :
   sans ça, la table ne fait que grossir. Le champ `passwordHash` n'est jamais
   remonté — il n'a rien à faire au-delà de la vérification du mot de passe. */
export async function getUtilisateurCourant() {
	const boite = await cookies();
	const jeton = boite.get(NOM_COOKIE)?.value;
	if (!jeton) return null;

	const session = await prisma.session.findUnique({
		where: {token: jeton},
		include: {
			user: {
				select: {
					id: true,
					email: true,
					firstName: true,
					lastName: true,
					phone: true,
					role: true,
					marketingOptIn: true,
					anonymizedAt: true,
					createdAt: true,
				},
			},
		},
	});

	if (!session) return null;

	if (session.expiresAt < new Date()) {
		await prisma.session.delete({where: {id: session.id}}).catch(() => {});
		return null;
	}

	// Un compte anonymisé (droit à l'effacement) ne se reconnecte pas.
	if (session.user.anonymizedAt) return null;

	return session.user;
}

/* Prolonge la session si elle a passé la moitié de sa vie.

   Séparé de la lecture parce qu'il écrit : une page peut lire l'utilisateur
   courant, seule une action ou une route a le droit de toucher au cookie. */
export async function prolongerSession() {
	const boite = await cookies();
	const jeton = boite.get(NOM_COOKIE)?.value;
	if (!jeton) return;

	const session = await prisma.session.findUnique({where: {token: jeton}});
	if (!session) return;

	const restant = session.expiresAt.getTime() - Date.now();
	const totale = DUREE_JOURS * 24 * 60 * 60 * 1000;

	if (restant > totale * SEUIL_PROLONGATION) return;

	await prisma.session.update({
		where: {id: session.id},
		data: {expiresAt: dateExpiration()},
	});
}

/// Ferme la session courante : la ligne en base, puis le cookie. Dans cet
/// ordre — un cookie effacé alors que la session survit laisserait un jeton
/// valable dans la nature.
export async function fermerSession() {
	const boite = await cookies();
	const jeton = boite.get(NOM_COOKIE)?.value;

	if (jeton) {
		await prisma.session.deleteMany({where: {token: jeton}});
	}

	boite.delete(NOM_COOKIE);
}

/// Ferme toutes les sessions d'un compte — changement de mot de passe, appareil
/// perdu, soupçon de compromission.
export async function fermerToutesLesSessions(userId) {
	await prisma.session.deleteMany({where: {userId}});
}
