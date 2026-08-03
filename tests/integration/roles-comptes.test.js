import {beforeEach, describe, expect, it} from 'vitest';
import {changerRole, getClient, listerClients} from '@/server/services/customers';
import {anonymiserCompte, inscrire} from '@/server/services/accounts';
import {baseDisponible, prisma, viderLaBase} from './aide';

/* Comptes et attribution des rôles.

   Donner un rôle est l'action la plus lourde du back-office : elle décide de
   qui voit le chiffre d'affaires et qui peut modifier les prix. Chaque test
   décrit une manière de s'enfermer dehors ou de s'octroyer un droit, et vérifie
   qu'elle échoue. */

async function creerCompte(email, role = 'CUSTOMER', prenom = null) {
	await inscrire({email, motDePasse: 'un-mot-de-passe-long', prenom});
	const compte = await prisma.user.findUnique({where: {email}});

	if (role !== 'CUSTOMER') {
		await prisma.user.update({where: {id: compte.id}, data: {role}});
	}

	return prisma.user.findUnique({where: {id: compte.id}});
}

describe.skipIf(!baseDisponible)('attribution des rôles', () => {
	let admin;
	let client;

	beforeEach(async () => {
		await viderLaBase();
		admin = await creerCompte('patron@exemple.fr', 'ADMIN', 'Le Vieux geek');
		client = await creerCompte('camille@exemple.fr');
	});

	it('nomme un préparateur', async () => {
		const resultat = await changerRole({
			cibleId: client.id,
			role: 'STAFF_ORDERS',
			auteurId: admin.id,
		});

		expect(resultat.ok).toBe(true);

		const apres = await prisma.user.findUnique({where: {id: client.id}});
		expect(apres.role).toBe('STAFF_ORDERS');
	});

	it('ferme les sessions de la personne dont le rôle change', async () => {
		/* Le cas qui compte : quelqu'un vient d'être rétrogradé. Ses droits sont
		   relus à chaque requête, mais une session ouverte lui laisserait l'écran
		   en cours entre les mains. */
		await prisma.session.create({
			data: {
				userId: client.id,
				token: 'session-en-cours',
				expiresAt: new Date(Date.now() + 86_400_000),
			},
		});

		await changerRole({cibleId: client.id, role: 'STAFF_ORDERS', auteurId: admin.id});

		expect(await prisma.session.count({where: {userId: client.id}})).toBe(0);
	});

	it('interdit de modifier son propre rôle', async () => {
		// Se rétrograder par mégarde fermerait la porte derrière soi.
		const resultat = await changerRole({
			cibleId: admin.id,
			role: 'CUSTOMER',
			auteurId: admin.id,
		});

		expect(resultat.ok).toBe(false);

		const apres = await prisma.user.findUnique({where: {id: admin.id}});
		expect(apres.role).toBe('ADMIN');
	});

	it('refuse de retirer le dernier administrateur', async () => {
		const secondAdmin = await creerCompte('associe@exemple.fr', 'ADMIN');

		// Le premier peut être rétrogradé tant qu'il en reste un autre.
		const premier = await changerRole({
			cibleId: admin.id,
			role: 'CUSTOMER',
			auteurId: secondAdmin.id,
		});
		expect(premier.ok).toBe(true);

		// Mais pas le dernier : la boutique deviendrait inadministrable.
		const dernier = await changerRole({
			cibleId: secondAdmin.id,
			role: 'CUSTOMER',
			auteurId: admin.id,
		});
		expect(dernier.ok).toBe(false);

		expect(await prisma.user.count({where: {role: 'ADMIN'}})).toBe(1);
	});

	it('refuse un rôle qui n’existe pas', async () => {
		const resultat = await changerRole({
			cibleId: client.id,
			role: 'SUPER_ADMIN',
			auteurId: admin.id,
		});

		expect(resultat.ok).toBe(false);

		const apres = await prisma.user.findUnique({where: {id: client.id}});
		expect(apres.role).toBe('CUSTOMER');
	});

	it('refuse d’agir sur un compte anonymisé', async () => {
		await anonymiserCompte(client.id, 'un-mot-de-passe-long');

		const resultat = await changerRole({
			cibleId: client.id,
			role: 'STAFF_ORDERS',
			auteurId: admin.id,
		});

		expect(resultat.ok).toBe(false);
	});
});

describe.skipIf(!baseDisponible)('liste des comptes', () => {
	beforeEach(async () => {
		await viderLaBase();
		await creerCompte('patron@exemple.fr', 'ADMIN', 'Le Vieux geek');
		await creerCompte('prepa@exemple.fr', 'STAFF_ORDERS', 'Alex');
		await creerCompte('camille@exemple.fr', 'CUSTOMER', 'Camille');
	});

	it('liste tout le monde par défaut', async () => {
		expect(await listerClients()).toHaveLength(3);
	});

	it('sait ne montrer que l’équipe', async () => {
		const equipe = await listerClients({staffSeulement: true});

		expect(equipe).toHaveLength(2);
		expect(equipe.every((compte) => compte.role !== 'CUSTOMER')).toBe(true);
	});

	it('cherche par nom comme par e-mail, sans tenir compte de la casse', async () => {
		expect(await listerClients({recherche: 'CAMILLE'})).toHaveLength(1);
		expect(await listerClients({recherche: 'prepa@'})).toHaveLength(1);
		expect(await listerClients({recherche: 'personne'})).toHaveLength(0);
	});

	it('écarte les comptes anonymisés', async () => {
		const camille = await prisma.user.findUnique({where: {email: 'camille@exemple.fr'}});
		await anonymiserCompte(camille.id, 'un-mot-de-passe-long');

		expect(await listerClients()).toHaveLength(2);
	});

	it('remonte le nombre de commandes sans le détail', async () => {
		const camille = await prisma.user.findUnique({where: {email: 'camille@exemple.fr'}});
		const fiche = await getClient(camille.id);

		expect(fiche.orders).toEqual([]);
		expect(fiche.email).toBe('camille@exemple.fr');
		// Le mot de passe n'a rien à faire dans une fiche d'administration.
		expect(fiche.passwordHash).toBeUndefined();
	});
});
