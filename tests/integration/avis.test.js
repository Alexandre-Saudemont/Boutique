import {beforeEach, describe, expect, it} from 'vitest';
import {
	deposerAvis,
	getAvisPublics,
	listerAvisAdmin,
	modererAvis,
	repondreAvis,
} from '@/server/services/reviews';
import {inscrire} from '@/server/services/accounts';
import {addItem} from '@/server/services/cart';
import {creerCommande} from '@/server/services/checkout';
import {
	baseDisponible,
	creerModeLivraison,
	creerProduit,
	ouvrirLaBoutique,
	prisma,
	viderLaBase,
} from './aide';

/* Avis clients.

   Le fil conducteur : rien n'apparaît en boutique sans avoir été lu, et la note
   affichée correspond toujours aux avis publiés. */

async function creerClient(email = 'camille@exemple.fr', prenom = 'Camille') {
	await inscrire({email, motDePasse: 'un-mot-de-passe-long', prenom});
	return prisma.user.findUnique({where: {email}});
}

describe.skipIf(!baseDisponible)('dépôt d’un avis', () => {
	let produit;
	let client;

	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
		produit = await creerProduit();
		client = await creerClient();
	});

	it('part en attente et n’apparaît pas en boutique', async () => {
		const resultat = await deposerAvis({
			productId: produit.id,
			utilisateur: client,
			note: 5,
			contenu: 'Une pièce magnifique, bien emballée.',
		});

		expect(resultat.ok).toBe(true);
		expect(resultat.enAttente).toBe(true);
		expect(await getAvisPublics(produit.id)).toHaveLength(0);
	});

	it('refuse un avis anonyme', async () => {
		const resultat = await deposerAvis({
			productId: produit.id,
			utilisateur: null,
			note: 5,
			contenu: 'Formidable, vraiment.',
		});

		expect(resultat.ok).toBe(false);
		expect(await prisma.review.count()).toBe(0);
	});

	it('prend le nom du compte, jamais celui du formulaire', async () => {
		/* Sans cette règle, n'importe qui signerait « Le Vieux geek » un avis
		   dithyrambique sur sa propre boutique. */
		await deposerAvis({
			productId: produit.id,
			utilisateur: {...client, firstName: 'Camille'},
			note: 5,
			contenu: 'Une pièce magnifique.',
			authorName: 'Le Vieux geek',
		});

		const avis = await prisma.review.findFirst();
		expect(avis.authorName).toBe('Camille');
	});

	it('n’accepte qu’un avis par personne et par pièce', async () => {
		await deposerAvis({
			productId: produit.id,
			utilisateur: client,
			note: 5,
			contenu: 'Une pièce magnifique.',
		});

		const second = await deposerAvis({
			productId: produit.id,
			utilisateur: client,
			note: 1,
			contenu: 'Finalement non, je change d’avis.',
		});

		expect(second.ok).toBe(false);
		expect(await prisma.review.count()).toBe(1);
	});

	it('refuse une note hors de 1 à 5', async () => {
		for (const note of [0, 6, -1, 2.5, 'cinq']) {
			const resultat = await deposerAvis({
				productId: produit.id,
				utilisateur: client,
				note,
				contenu: 'Un texte assez long pour passer.',
			});

			expect(resultat.ok, String(note)).toBe(false);
		}
	});

	it('refuse un texte trop court ou démesuré', async () => {
		const court = await deposerAvis({
			productId: produit.id,
			utilisateur: client,
			note: 4,
			contenu: 'Bien',
		});
		const long = await deposerAvis({
			productId: produit.id,
			utilisateur: client,
			note: 4,
			contenu: 'a'.repeat(4001),
		});

		expect(court.ok).toBe(false);
		expect(long.ok).toBe(false);
	});

	it('refuse un avis sur une pièce non publiée', async () => {
		const brouillon = await creerProduit({publie: false});

		const resultat = await deposerAvis({
			productId: brouillon.id,
			utilisateur: client,
			note: 5,
			contenu: 'Un texte assez long pour passer.',
		});

		expect(resultat.ok).toBe(false);
	});

	it('pose « achat vérifié » seulement après un achat payé', async () => {
		const sansAchat = await deposerAvis({
			productId: produit.id,
			utilisateur: client,
			note: 5,
			contenu: 'Un texte assez long pour passer.',
		});

		expect(sansAchat.ok).toBe(true);
		expect((await prisma.review.findFirst()).verifiedPurchase).toBe(false);

		// Deuxième client, qui a réellement acheté.
		const acheteur = await creerClient('acheteur@exemple.fr', 'Alex');
		const mode = await creerModeLivraison();
		await addItem('jeton-b', produit.variants[0].id, 1);
		const commande = await creerCommande({
			token: 'jeton-b',
			adresse: {
				firstName: 'Alex',
				lastName: 'Martin',
				line1: '1 rue A',
				postalCode: '69001',
				city: 'Lyon',
				email: 'acheteur@exemple.fr',
			},
			rateId: mode.id,
		});
		await prisma.order.update({
			where: {id: commande.id},
			data: {status: 'PAID', userId: acheteur.id},
		});

		await deposerAvis({
			productId: produit.id,
			utilisateur: acheteur,
			note: 5,
			contenu: 'Reçue en trois jours, parfaite.',
		});

		const avisVerifie = await prisma.review.findFirst({where: {userId: acheteur.id}});
		expect(avisVerifie.verifiedPurchase).toBe(true);
	});

	it('publie tout de suite si la modération est désactivée', async () => {
		await ouvrirLaBoutique({'reviews.moderation': 'NONE'});

		const resultat = await deposerAvis({
			productId: produit.id,
			utilisateur: client,
			note: 5,
			contenu: 'Un texte assez long pour passer.',
		});

		expect(resultat.enAttente).toBe(false);
		expect(await getAvisPublics(produit.id)).toHaveLength(1);
	});
});

describe.skipIf(!baseDisponible)('modération', () => {
	let produit;
	let avisId;

	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
		produit = await creerProduit();
		const client = await creerClient();

		const resultat = await deposerAvis({
			productId: produit.id,
			utilisateur: client,
			note: 4,
			contenu: 'Une belle pièce, livrée rapidement.',
		});
		avisId = resultat.id;
	});

	it('publie l’avis et met la note du produit à jour', async () => {
		await modererAvis(avisId, 'APPROVED');

		expect(await getAvisPublics(produit.id)).toHaveLength(1);

		const apres = await prisma.product.findUnique({where: {id: produit.id}});
		expect(apres.averageRating).toBe(4);
		expect(apres.reviewCount).toBe(1);
	});

	it('ne compte pas les avis en attente dans la note', async () => {
		// Sinon la modération ne servirait à rien : la note bougerait avant lecture.
		const apres = await prisma.product.findUnique({where: {id: produit.id}});

		expect(apres.reviewCount).toBe(0);
		expect(apres.averageRating).toBeNull();
	});

	it('retire de la boutique un avis refusé, sans le supprimer', async () => {
		await modererAvis(avisId, 'APPROVED');
		await modererAvis(avisId, 'REJECTED');

		expect(await getAvisPublics(produit.id)).toHaveLength(0);
		expect(await prisma.review.count()).toBe(1);

		const apres = await prisma.product.findUnique({where: {id: produit.id}});
		expect(apres.reviewCount).toBe(0);
		expect(apres.averageRating).toBeNull();
	});

	it('calcule une moyenne arrondie au dixième', async () => {
		const second = await creerClient('autre@exemple.fr', 'Alex');
		const autre = await deposerAvis({
			productId: produit.id,
			utilisateur: second,
			note: 5,
			contenu: 'Encore mieux que prévu.',
		});

		await modererAvis(avisId, 'APPROVED');
		await modererAvis(autre.id, 'APPROVED');

		const apres = await prisma.product.findUnique({where: {id: produit.id}});
		expect(apres.averageRating).toBe(4.5);
	});

	it('refuse une décision inconnue', async () => {
		expect((await modererAvis(avisId, 'SUPPRIME')).ok).toBe(false);
	});

	it('trie les avis à modérer du plus ancien au plus récent', async () => {
		const second = await creerClient('autre@exemple.fr', 'Alex');
		await deposerAvis({
			productId: produit.id,
			utilisateur: second,
			note: 3,
			contenu: 'Correct sans plus, mais conforme.',
		});

		const enAttente = await listerAvisAdmin({statut: 'PENDING'});

		expect(enAttente).toHaveLength(2);
		expect(enAttente[0].id).toBe(avisId);
	});

	it('affiche la réponse du commerçant sous l’avis publié', async () => {
		await modererAvis(avisId, 'APPROVED');
		await repondreAvis(avisId, '  Merci beaucoup !  ');

		const [avis] = await getAvisPublics(produit.id);
		expect(avis.adminReply).toBe('Merci beaucoup !');
	});

	it('efface la réponse quand on vide le champ', async () => {
		await modererAvis(avisId, 'APPROVED');
		await repondreAvis(avisId, 'Merci !');
		await repondreAvis(avisId, '   ');

		const [avis] = await getAvisPublics(produit.id);
		expect(avis.adminReply).toBeNull();
	});
});
