import {beforeEach, describe, expect, it} from 'vitest';
import {
	confirmerInscription,
	listerDestinataires,
	subscribe,
	unsubscribeByToken,
} from '@/server/services/newsletter';
import {baseDisponible, prisma, viderLaBase} from './aide';

/* Lettre de l'antre : double opt-in et désinscription.

   Ce que ces tests protègent, au fond, c'est la réputation d'expéditeur du
   client. Envoyer à une adresse non confirmée, c'est finir en indésirable pour
   tout le monde — y compris pour les clients qui, eux, attendent leur facture. */

describe.skipIf(!baseDisponible)('inscription à la lettre', () => {
	beforeEach(async () => {
		await viderLaBase();
	});

	it('inscrit sans confirmer : le clic sur le lien reste nécessaire', async () => {
		await subscribe('camille@exemple.fr', 'footer');

		const abonne = await prisma.newsletterSubscriber.findUnique({
			where: {email: 'camille@exemple.fr'},
		});

		expect(abonne).not.toBeNull();
		expect(abonne.confirmedAt).toBeNull();
		expect(abonne.consentAt).toBeInstanceOf(Date);
		expect(abonne.token).toBeTruthy();
	});

	it('n’envoie aucune lettre à une adresse non confirmée', async () => {
		await subscribe('camille@exemple.fr');

		expect(await listerDestinataires()).toHaveLength(0);
	});

	it('normalise la casse et les espaces', async () => {
		await subscribe('  Camille@Exemple.FR  ');

		expect(
			await prisma.newsletterSubscriber.findUnique({where: {email: 'camille@exemple.fr'}}),
		).not.toBeNull();
	});

	it('refuse une adresse qui n’en est pas une', async () => {
		expect((await subscribe('camille')).ok).toBe(false);
		expect(await prisma.newsletterSubscriber.count()).toBe(0);
	});

	it('ne crée jamais de doublon', async () => {
		await subscribe('camille@exemple.fr');
		await subscribe('camille@exemple.fr');

		expect(await prisma.newsletterSubscriber.count()).toBe(1);
	});
});

describe.skipIf(!baseDisponible)('confirmation', () => {
	beforeEach(async () => {
		await viderLaBase();
		await subscribe('camille@exemple.fr', 'footer');
	});

	it('confirme et fait entrer l’adresse dans la liste d’envoi', async () => {
		const abonne = await prisma.newsletterSubscriber.findFirst();

		const resultat = await confirmerInscription(abonne.token);

		expect(resultat.ok).toBe(true);
		expect(await listerDestinataires()).toHaveLength(1);
	});

	it('accepte un second clic sur le même lien sans se plaindre', async () => {
		const abonne = await prisma.newsletterSubscriber.findFirst();

		await confirmerInscription(abonne.token);
		const seconde = await confirmerInscription(abonne.token);

		expect(seconde.ok).toBe(true);
	});

	it('refuse un jeton inventé ou vide', async () => {
		expect((await confirmerInscription('jeton-invente')).ok).toBe(false);
		expect((await confirmerInscription('')).ok).toBe(false);
		expect((await confirmerInscription(undefined)).ok).toBe(false);

		expect(await listerDestinataires()).toHaveLength(0);
	});
});

describe.skipIf(!baseDisponible)('désinscription', () => {
	beforeEach(async () => {
		await viderLaBase();
		await subscribe('camille@exemple.fr');
	});

	it('retire immédiatement de la liste d’envoi', async () => {
		const abonne = await prisma.newsletterSubscriber.findFirst();
		await confirmerInscription(abonne.token);

		const resultat = await unsubscribeByToken(abonne.token);

		expect(resultat.ok).toBe(true);
		expect(await listerDestinataires()).toHaveLength(0);
	});

	it('garde la trace du retrait plutôt que d’effacer la ligne', async () => {
		// C'est cette trace qui prouve, en cas de plainte, qu'on a bien cessé
		// d'écrire — et qui empêche une réimportation étourdie.
		const abonne = await prisma.newsletterSubscriber.findFirst();

		await unsubscribeByToken(abonne.token);

		const apres = await prisma.newsletterSubscriber.findUnique({where: {id: abonne.id}});
		expect(apres.unsubscribedAt).toBeInstanceOf(Date);
	});

	it('refuse un jeton inconnu', async () => {
		expect((await unsubscribeByToken('jeton-invente')).ok).toBe(false);
	});

	it('permet de revenir : la réinscription redemande une confirmation', async () => {
		const abonne = await prisma.newsletterSubscriber.findFirst();
		await confirmerInscription(abonne.token);
		await unsubscribeByToken(abonne.token);

		await subscribe('camille@exemple.fr');

		const apres = await prisma.newsletterSubscriber.findUnique({where: {id: abonne.id}});
		expect(apres.unsubscribedAt).toBeNull();
		expect(await prisma.newsletterSubscriber.count()).toBe(1);
	});
});
