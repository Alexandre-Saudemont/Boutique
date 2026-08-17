import 'server-only';
import {prisma} from '@/server/db';

/* Les colis d'une commande.
 *
 * Une commande ordinaire part en un seul envoi. Une commande qui mêle des
 * pièces disponibles et une précommande peut partir en deux, si le client l'a
 * demandé au tunnel : ce qu'il a sous la main tout de suite, le reste à la
 * réception du réassort.
 *
 * Ce fichier ne sait rien des écrans : il dit ce qui part quand, fabrique les
 * colis à la commande, et juge de l'avancement d'une expédition. Le calcul du
 * prix reste chez `checkout`, l'affichage chez les pages.
 */

export const LIBELLE_IMMEDIAT = 'Disponible tout de suite';
export const LIBELLE_ATTENTE = 'À la réception de la précommande';

/* Cette ligne doit-elle attendre ?
 *
 * Deux conditions, et les deux comptent. Le produit doit être proposé en
 * précommande — sans ce drapeau, une rupture ordinaire ferait basculer la
 * commande en deux colis alors que le client n'a rien demandé. Et le stock doit
 * être insuffisant : une pièce marquée « précommande » mais qu'on a en rayon
 * part avec le reste, il n'y a rien à attendre.
 *
 * Les deux drapeaux ne vivent pas au même endroit, et c'est voulu :
 * `allowPreorder` décrit le produit — une figurine annoncée pour octobre l'est
 * dans tous ses coloris — tandis que `allowBackorder` décrit une déclinaison
 * précise, celle qu'on réapprovisionne en continu. Ce second l'emporte sur le
 * stock : une déclinaison en réassort permanent est toujours servie, son stock
 * ne veut rien dire. */
export function ligneEnAttente(variante, quantite) {
	if (!variante?.product?.allowPreorder) return false;
	if (variante.allowBackorder) return false;

	return (variante.stock ?? 0) < quantite;
}

/* Le panier mélange-t-il du disponible et de l'attendu ?
 *
 * C'est la seule situation où la question du colis unique se pose. Un panier
 * entièrement disponible part en une fois, un panier entièrement en
 * précommande aussi — dans les deux cas, proposer un choix n'aurait aucun sens
 * et ne ferait qu'inquiéter.
 *
 * Les lignes numériques sont ignorées : elles ne partent dans aucun colis, et
 * un ouvrage à télécharger accompagné d'une figurine en précommande ne fait pas
 * une commande scindable. */
export function analyserPanier(lignes) {
	const physiques = lignes.filter((ligne) => ligne.variant?.product?.kind !== 'DIGITAL');

	const attendues = physiques.filter((ligne) => ligneEnAttente(ligne.variant, ligne.quantity));
	const immediates = physiques.filter((ligne) => !ligneEnAttente(ligne.variant, ligne.quantity));

	return {
		scindable: attendues.length > 0 && immediates.length > 0,
		aDeLAttente: attendues.length > 0,
		immediates,
		attendues,
	};
}

/* Fabrique les colis d'une commande qu'on vient d'écrire.
 *
 * Appelé dans la transaction de création, avec le client transactionnel : un
 * colis sans commande, ou une commande dont les lignes ne savent pas par où
 * elles partent, ne doit jamais exister, même une milliseconde.
 *
 * Les lignes sont rattachées par leur `sku`, seul lien stable entre l'article
 * du panier et la ligne de commande qui vient d'être créée — l'identifiant de
 * la ligne n'existait pas avant l'écriture. */
export async function creerColis(tx, {orderId, scindee, transporteur, articles}) {
	const physiques = articles.filter((article) => article.kind !== 'DIGITAL');

	// Rien à expédier : une commande entièrement dématérialisée n'a pas de colis,
	// et lui en fabriquer un ferait apparaître un envoi fantôme au back-office.
	if (physiques.length === 0) return [];

	const skusEnAttente = new Set(
		physiques.filter((article) => article.enAttente).map((article) => article.sku),
	);

	if (!scindee || skusEnAttente.size === 0 || skusEnAttente.size === physiques.length) {
		const colis = await tx.shipment.create({
			data: {orderId, position: 1, label: 'Colis', carrier: transporteur ?? null},
		});

		await tx.orderItem.updateMany({
			where: {orderId, kind: {not: 'DIGITAL'}},
			data: {shipmentId: colis.id},
		});

		return [colis];
	}

	const premier = await tx.shipment.create({
		data: {orderId, position: 1, label: LIBELLE_IMMEDIAT, carrier: transporteur ?? null},
	});

	const second = await tx.shipment.create({
		data: {orderId, position: 2, label: LIBELLE_ATTENTE, carrier: transporteur ?? null},
	});

	await tx.orderItem.updateMany({
		where: {orderId, kind: {not: 'DIGITAL'}, sku: {notIn: [...skusEnAttente]}},
		data: {shipmentId: premier.id},
	});

	await tx.orderItem.updateMany({
		where: {orderId, kind: {not: 'DIGITAL'}, sku: {in: [...skusEnAttente]}},
		data: {shipmentId: second.id},
	});

	return [premier, second];
}

/* Le statut que la commande doit prendre après l'expédition d'un colis.
 *
 * C'est le seul endroit qui en décide. Laisser chaque écran conclure « il reste
 * un colis, donc partiellement expédiée » reviendrait à réécrire la même
 * comparaison à trois endroits, avec trois occasions de la faire diverger. */
export function statutApresExpedition(colis) {
	const restants = colis.filter((envoi) => !envoi.shippedAt);

	return restants.length === 0 ? 'SHIPPED' : 'PARTIALLY_SHIPPED';
}

/* Ce que le tunnel a besoin de savoir d'un panier, pour poser — ou non — la
 * question des deux colis.
 *
 * Renvoie de quoi écrire la phrase que lit le client : ce qui part maintenant,
 * ce qui attend, et s'il y a un choix à faire. Les noms de produits sont
 * inclus parce qu'une liste vaut mieux qu'un décompte : « votre figurine
 * Rônin » se comprend, « 1 article » non. */
export async function analyserExpeditionDuPanier(token) {
	const lignes = await prisma.cartItem.findMany({
		where: {cart: {sessionToken: token}},
		include: {
			variant: {include: {product: {select: {name: true, kind: true, allowPreorder: true}}}},
		},
	});

	const {scindable, immediates, attendues} = analyserPanier(lignes);

	const nommer = (liste) =>
		liste.map((ligne) => ({
			nom: ligne.variant.product.name,
			variante: ligne.variant.name,
			quantite: ligne.quantity,
		}));

	return {
		scindable,
		immediates: nommer(immediates),
		attendues: nommer(attendues),
	};
}

/// Les colis d'une commande, dans l'ordre, avec ce qu'ils contiennent.
export async function colisDeCommande(orderId) {
	return prisma.shipment.findMany({
		where: {orderId},
		orderBy: {position: 'asc'},
		include: {items: {select: {id: true, productName: true, variantName: true, quantity: true}}},
	});
}
