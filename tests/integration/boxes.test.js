import {beforeEach, describe, expect, it} from 'vitest';
import {
	ajouterPieceBox,
	getBoxesDeLaCommande,
	getContenuBoxes,
	retirerPieceBox,
} from '@/server/services/boxes';
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

/* Box surprises.

   Une box se vend comme n'importe quel produit — il n'y a rien à tester là. Ce
   qui compte est ailleurs : chaque exemplaire vendu part avec un contenu
   différent, et il faut pouvoir le retrouver des mois plus tard.

   Le contenu ne vient pas du catalogue : les pièces mises en box sont achetées
   à part et ne sont jamais en vente à l'unité. Rien n'est donc décompté du
   stock de la boutique, et ces tests le vérifient. */

const ADRESSE = {
	firstName: 'Camille',
	lastName: 'Renaud',
	line1: '12 rue des Trouvailles',
	postalCode: '69001',
	city: 'Lyon',
	email: 'camille@exemple.fr',
};

async function creerBox({stock = 5} = {}) {
	const produit = await creerProduit({nom: 'Box Manga', prixCents: 4000, stock});

	await prisma.product.update({
		where: {id: produit.id},
		data: {isMysteryBox: true},
	});

	return produit;
}

async function commanderBoxes(quantite) {
	const mode = await creerModeLivraison();
	const box = await creerBox();

	await addItem('jeton-box', box.variants[0].id, quantite);

	const resultat = await creerCommande({
		token: 'jeton-box',
		adresse: ADRESSE,
		rateId: mode.id,
	});

	const ligne = await prisma.orderItem.findFirst({where: {orderId: resultat.id}});

	return {commandeId: resultat.id, ligne, box};
}

describe.skipIf(!baseDisponible)('box surprises', () => {
	beforeEach(async () => {
		await viderLaBase();
		await ouvrirLaBoutique();
	});

	it('marque la ligne de commande comme box, en copie figée', async () => {
		/* La copie compte : un produit qui cesse d'être une box demain ne doit pas
		   faire disparaître la saisie de contenu d'une commande d'hier. */
		const {ligne, box} = await commanderBoxes(1);

		expect(ligne.isMysteryBox).toBe(true);

		await prisma.product.update({where: {id: box.id}, data: {isMysteryBox: false}});

		const relue = await prisma.orderItem.findUnique({where: {id: ligne.id}});
		expect(relue.isMysteryBox).toBe(true);
	});

	it('ouvre autant de listes que de box commandées', async () => {
		/* Deux box identiques dans une commande n'ont pas le même contenu : sans
		   liste séparée, on ne pourrait pas dire laquelle contenait quoi. */
		const {ligne} = await commanderBoxes(3);

		const contenu = await getContenuBoxes(ligne.id);

		expect(contenu).toHaveLength(3);
		expect(contenu.map((box) => box.numero)).toEqual([1, 2, 3]);
		expect(contenu.every((box) => box.pieces.length === 0)).toBe(true);
	});

	it('garde les pièces dans l’ordre de saisie, box par box', async () => {
		const {ligne} = await commanderBoxes(2);

		await ajouterPieceBox({orderItemId: ligne.id, boxNumber: 1, label: 'Figurine Chopper'});
		await ajouterPieceBox({orderItemId: ligne.id, boxNumber: 2, label: 'Tome 1 de Berserk'});
		await ajouterPieceBox({
			orderItemId: ligne.id,
			boxNumber: 1,
			label: 'Porte-clés',
			note: 'léger défaut de peinture',
		});

		const contenu = await getContenuBoxes(ligne.id);

		expect(contenu[0].pieces.map((piece) => piece.label)).toEqual([
			'Figurine Chopper',
			'Porte-clés',
		]);
		expect(contenu[0].pieces[1].note).toBe('léger défaut de peinture');
		expect(contenu[1].pieces.map((piece) => piece.label)).toEqual(['Tome 1 de Berserk']);
	});

	it('refuse une box qui n’existe pas dans la commande', async () => {
		/* Le formulaire n'affiche que les box vendues, mais une action serveur est
		   appelable sans passer par sa page. */
		const {ligne} = await commanderBoxes(2);

		expect((await ajouterPieceBox({orderItemId: ligne.id, boxNumber: 3, label: 'x'})).ok).toBe(
			false,
		);
		expect((await ajouterPieceBox({orderItemId: ligne.id, boxNumber: 0, label: 'x'})).ok).toBe(
			false,
		);
		expect(await prisma.boxContentItem.count()).toBe(0);
	});

	it('refuse d’ajouter du contenu à une ligne qui n’est pas une box', async () => {
		const mode = await creerModeLivraison();
		const figurine = await creerProduit();

		await addItem('jeton-simple', figurine.variants[0].id, 1);
		const commande = await creerCommande({
			token: 'jeton-simple',
			adresse: ADRESSE,
			rateId: mode.id,
		});

		const ligne = await prisma.orderItem.findFirst({where: {orderId: commande.id}});

		expect((await ajouterPieceBox({orderItemId: ligne.id, boxNumber: 1, label: 'x'})).ok).toBe(
			false,
		);
		expect(await getContenuBoxes(ligne.id)).toEqual([]);
	});

	it('refuse un intitulé vide ou démesuré', async () => {
		const {ligne} = await commanderBoxes(1);

		expect((await ajouterPieceBox({orderItemId: ligne.id, boxNumber: 1, label: '   '})).ok).toBe(
			false,
		);
		expect(
			(await ajouterPieceBox({orderItemId: ligne.id, boxNumber: 1, label: 'x'.repeat(201)})).ok,
		).toBe(false);
	});

	it('ne décompte rien du stock de la boutique', async () => {
		/* Le contenu vient d'un stock à part, qui n'est pas au catalogue. Seul le
		   nombre de box disponibles est un stock, et il ne bouge qu'au paiement
		   comme pour tout le reste. */
		const {box, ligne} = await commanderBoxes(1);

		await ajouterPieceBox({orderItemId: ligne.id, boxNumber: 1, label: 'Figurine rare'});

		const variante = await prisma.productVariant.findUnique({where: {id: box.variants[0].id}});

		// La commande est en attente de paiement : rien n'a encore bougé.
		expect(variante.stock).toBe(5);
	});

	it('retire une pièce mal notée', async () => {
		const {ligne} = await commanderBoxes(1);

		const ajout = await ajouterPieceBox({
			orderItemId: ligne.id,
			boxNumber: 1,
			label: 'Fugurine Chopper',
		});

		expect((await retirerPieceBox(ajout.piece.id)).ok).toBe(true);
		expect((await getContenuBoxes(ligne.id))[0].pieces).toHaveLength(0);
		expect((await retirerPieceBox(ajout.piece.id)).ok).toBe(false);
	});

	it('remonte les box d’une commande pour la fiche du back-office', async () => {
		const {commandeId, ligne} = await commanderBoxes(2);

		await ajouterPieceBox({orderItemId: ligne.id, boxNumber: 2, label: 'Sticker'});

		const boxes = await getBoxesDeLaCommande(commandeId);

		expect(boxes).toHaveLength(1);
		expect(boxes[0].nom).toBe('Box Manga');
		expect(boxes[0].exemplaires).toHaveLength(2);
		expect(boxes[0].exemplaires[1].pieces[0].label).toBe('Sticker');
	});

	it('ne remonte aucune box sur une commande ordinaire', async () => {
		const mode = await creerModeLivraison();
		const figurine = await creerProduit();

		await addItem('jeton-simple', figurine.variants[0].id, 1);
		const commande = await creerCommande({
			token: 'jeton-simple',
			adresse: ADRESSE,
			rateId: mode.id,
		});

		expect(await getBoxesDeLaCommande(commande.id)).toEqual([]);
	});
});
