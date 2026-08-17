import {beforeEach, describe, expect, it} from 'vitest';
import {createHash} from 'node:crypto';
import {consommerJeton, creerJeton, purgerJetons} from '@/server/auth/tokens';
import {
	connecter,
	demanderReinitialisation,
	inscrire,
	reinitialiserMotDePasse,
	verifierEmail,
} from '@/server/services/accounts';
import {creerSession} from '@/server/auth/session';
import {baseDisponible, prisma, viderLaBase} from './aide';

/* Jetons de réinitialisation et de vérification.

   C'est le morceau le plus sensible du site après le paiement : un défaut ici
   donne un compte à qui n'aurait pas dû l'avoir. Chaque test décrit une manière
   précise de s'y prendre, et vérifie qu'elle échoue. */

const IDENTIFIANTS = {email: 'camille@exemple.fr', motDePasse: 'mot-de-passe-initial'};

async function creerCompte() {
	await inscrire(IDENTIFIANTS);
	return prisma.user.findUnique({where: {email: IDENTIFIANTS.email}});
}

describe.skipIf(!baseDisponible)('cycle de vie d’un jeton', () => {
	let utilisateur;

	beforeEach(async () => {
		await viderLaBase();
		utilisateur = await creerCompte();
	});

	it('ne stocke jamais le jeton en clair', async () => {
		/* Le scénario redouté : une copie de la base fuite. Si les jetons y sont
		   en clair, chaque compte ayant une demande en cours est ouvert. */
		const jeton = await creerJeton(utilisateur.id, 'PASSWORD_RESET');

		const enregistre = await prisma.verificationToken.findFirst();

		expect(enregistre.tokenHash).not.toBe(jeton);
		expect(enregistre.tokenHash).toBe(createHash('sha256').update(jeton).digest('hex'));
	});

	it('accepte le jeton une fois, et une seule', async () => {
		const jeton = await creerJeton(utilisateur.id, 'PASSWORD_RESET');

		expect(await consommerJeton(jeton, 'PASSWORD_RESET')).toBe(utilisateur.id);
		// Un lien resté dans une boîte mail ne doit pas rouvrir le compte plus
		// tard.
		expect(await consommerJeton(jeton, 'PASSWORD_RESET')).toBeNull();
	});

	it('refuse un jeton utilisé pour un autre usage', async () => {
		// Sans ce contrôle, un lien de vérification d'adresse — plus long à
		// expirer et plus banal — servirait à changer un mot de passe.
		const jeton = await creerJeton(utilisateur.id, 'EMAIL_VERIFY');

		expect(await consommerJeton(jeton, 'PASSWORD_RESET')).toBeNull();
	});

	it('refuse un jeton expiré', async () => {
		const jeton = await creerJeton(utilisateur.id, 'PASSWORD_RESET');

		await prisma.verificationToken.updateMany({
			data: {expiresAt: new Date(Date.now() - 1000)},
		});

		expect(await consommerJeton(jeton, 'PASSWORD_RESET')).toBeNull();
	});

	it('refuse un jeton inventé, vide ou absent', async () => {
		for (const essai of ['jeton-invente', '', null, undefined, 42]) {
			expect(await consommerJeton(essai, 'PASSWORD_RESET'), String(essai)).toBeNull();
		}
	});

	it('ferme le jeton précédent quand un nouveau est demandé', async () => {
		/* Quelqu'un redemande un lien parce qu'il soupçonne que le premier a été
		   intercepté : le premier doit cesser de fonctionner immédiatement. */
		const ancien = await creerJeton(utilisateur.id, 'PASSWORD_RESET');
		await creerJeton(utilisateur.id, 'PASSWORD_RESET');

		expect(await consommerJeton(ancien, 'PASSWORD_RESET')).toBeNull();
	});

	it('ne laisse pas deux usages simultanés passer', async () => {
		const jeton = await creerJeton(utilisateur.id, 'PASSWORD_RESET');

		const [a, b] = await Promise.all([
			consommerJeton(jeton, 'PASSWORD_RESET'),
			consommerJeton(jeton, 'PASSWORD_RESET'),
		]);

		// Exactement un des deux aboutit.
		expect([a, b].filter(Boolean)).toHaveLength(1);
	});

	it('purge les jetons anciens sans toucher aux jetons vivants', async () => {
		const vivant = await creerJeton(utilisateur.id, 'EMAIL_VERIFY');
		await prisma.verificationToken.create({
			data: {
				userId: utilisateur.id,
				purpose: 'PASSWORD_RESET',
				tokenHash: 'vieux-hash',
				expiresAt: new Date('2020-01-01'),
			},
		});

		const supprimes = await purgerJetons(30);

		expect(supprimes).toBe(1);
		expect(await consommerJeton(vivant, 'EMAIL_VERIFY')).toBe(utilisateur.id);
	});
});

describe.skipIf(!baseDisponible)('réinitialisation du mot de passe', () => {
	let utilisateur;

	beforeEach(async () => {
		await viderLaBase();
		utilisateur = await creerCompte();
	});

	it('ne dit pas si l’adresse est connue', async () => {
		const connue = await demanderReinitialisation(IDENTIFIANTS.email);
		const inconnue = await demanderReinitialisation('personne@ailleurs.fr');

		expect(connue.ok).toBe(true);
		expect(inconnue.ok).toBe(true);

		// Mais un seul jeton a réellement été créé.
		expect(await prisma.verificationToken.count()).toBe(1);
	});

	it('change le mot de passe et permet la connexion avec le nouveau', async () => {
		const jeton = await creerJeton(utilisateur.id, 'PASSWORD_RESET');

		const resultat = await reinitialiserMotDePasse(jeton, 'un-nouveau-mot-de-passe');

		expect(resultat.ok).toBe(true);
		expect((await connecter({...IDENTIFIANTS, motDePasse: 'un-nouveau-mot-de-passe'})).ok).toBe(
			true,
		);
		expect((await connecter(IDENTIFIANTS)).ok).toBe(false);
	});

	it('ferme toutes les sessions ouvertes', async () => {
		/* Le cas qui justifie ce comportement : le compte est compromis, l'intrus
		   a une session ouverte. Changer le mot de passe sans fermer les sessions
		   ne le met pas dehors. */
		await prisma.session.createMany({
			data: [
				{userId: utilisateur.id, token: 'session-1', expiresAt: new Date(Date.now() + 86_400_000)},
				{userId: utilisateur.id, token: 'session-2', expiresAt: new Date(Date.now() + 86_400_000)},
			],
		});

		const jeton = await creerJeton(utilisateur.id, 'PASSWORD_RESET');
		await reinitialiserMotDePasse(jeton, 'un-nouveau-mot-de-passe');

		expect(await prisma.session.count({where: {userId: utilisateur.id}})).toBe(0);
	});

	it('marque l’adresse vérifiée : la personne vient de prouver qu’elle y accède', async () => {
		const jeton = await creerJeton(utilisateur.id, 'PASSWORD_RESET');

		await reinitialiserMotDePasse(jeton, 'un-nouveau-mot-de-passe');

		const apres = await prisma.user.findUnique({where: {id: utilisateur.id}});
		expect(apres.emailVerifiedAt).toBeInstanceOf(Date);
	});

	it('refuse un mot de passe trop court sans consommer le jeton', async () => {
		// Une erreur de saisie ne doit pas obliger à refaire toute la procédure.
		const jeton = await creerJeton(utilisateur.id, 'PASSWORD_RESET');

		expect((await reinitialiserMotDePasse(jeton, 'court')).ok).toBe(false);
		expect((await reinitialiserMotDePasse(jeton, 'un-mot-de-passe-correct')).ok).toBe(true);
	});

	it('refuse un jeton invalide sans rien changer', async () => {
		const resultat = await reinitialiserMotDePasse('jeton-invente', 'un-nouveau-mot-de-passe');

		expect(resultat.ok).toBe(false);
		expect((await connecter(IDENTIFIANTS)).ok).toBe(true);
	});

	it('ne réinitialise pas un compte anonymisé', async () => {
		await prisma.user.update({
			where: {id: utilisateur.id},
			data: {anonymizedAt: new Date()},
		});

		await demanderReinitialisation(IDENTIFIANTS.email);

		expect(await prisma.verificationToken.count()).toBe(0);
	});
});

describe.skipIf(!baseDisponible)('vérification de l’adresse', () => {
	let utilisateur;

	beforeEach(async () => {
		await viderLaBase();
		utilisateur = await creerCompte();
	});

	it('marque l’adresse vérifiée', async () => {
		const jeton = await creerJeton(utilisateur.id, 'EMAIL_VERIFY');

		expect((await verifierEmail(jeton)).ok).toBe(true);

		const apres = await prisma.user.findUnique({where: {id: utilisateur.id}});
		expect(apres.emailVerifiedAt).toBeInstanceOf(Date);
	});

	it('refuse un jeton de réinitialisation détourné', async () => {
		const jeton = await creerJeton(utilisateur.id, 'PASSWORD_RESET');

		expect((await verifierEmail(jeton)).ok).toBe(false);
	});

	it('laisse la session ouverte : vérifier n’est pas se reconnecter', async () => {
		// Contrairement à la réinitialisation, la vérification d'adresse ne
		// signale aucune compromission : déconnecter serait gratuitement pénible.
		const jeton = await creerJeton(utilisateur.id, 'EMAIL_VERIFY');
		await prisma.session.create({
			data: {userId: utilisateur.id, token: 'session-1', expiresAt: new Date(Date.now() + 86_400_000)},
		});

		await verifierEmail(jeton);

		expect(await prisma.session.count({where: {userId: utilisateur.id}})).toBe(1);
	});
});
