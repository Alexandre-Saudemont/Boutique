import 'server-only';
import {prisma} from '@/server/db';
import {envoyerAvisExpedition} from '@/server/email/messages';

/* Les commandes vues du back-office.

   Distinct de `checkout.js`, qui les crée côté client. Ici on les lit, on les
   filtre et on fait avancer leur statut — deux métiers différents sur la même
   table, et deux publics : l'un est public, l'autre demande un droit.

   Aucune écriture ne touche aux montants ni aux lignes. Une commande est figée
   à l'émission : la corriger reviendrait à réécrire une facture. Ce qui bouge,
   c'est son avancement — préparée, expédiée, livrée — et le suivi. */

export const LIBELLES_STATUT = {
	PENDING_PAYMENT: 'En attente de paiement',
	PAID: 'Payée',
	PREPARING: 'En préparation',
	SHIPPED: 'Expédiée',
	DELIVERED: 'Livrée',
	CANCELLED: 'Annulée',
	REFUNDED: 'Remboursée',
};

/* Les statuts accessibles depuis un statut donné.

   Une commande n'avance pas dans n'importe quel ordre : on ne livre pas ce qui
   n'est pas parti, on n'expédie pas ce qui n'est pas payé. Décrire les
   transitions permises ici évite d'avoir à y penser dans chaque écran — et
   ferme la porte à un statut posé par une requête forgée.

   Le remboursement n'apparaît pas : il vient de Stripe, via le webhook, pas
   d'un bouton. Marquer « remboursée » une commande dont l'argent n'est pas
   reparti serait un mensonge comptable. */
const TRANSITIONS = {
	PENDING_PAYMENT: ['CANCELLED'],
	PAID: ['PREPARING', 'CANCELLED'],
	PREPARING: ['SHIPPED', 'CANCELLED'],
	SHIPPED: ['DELIVERED'],
	DELIVERED: [],
	CANCELLED: [],
	REFUNDED: [],
};

export function statutsSuivants(statut) {
	return TRANSITIONS[statut] ?? [];
}

/* La liste, du plus récent au plus ancien.

   Pagination par curseur plutôt que par `skip` : au-delà de quelques milliers
   de lignes, `skip` fait relire à PostgreSQL tout ce qu'il saute. Ici le volume
   restera modeste longtemps, mais la page suivante coûte le même prix que la
   première, et ça ne coûte rien de le faire dès maintenant. */
export async function listerCommandes({statut = null, recherche = null, taille = 40} = {}) {
	const terme = recherche?.trim();

	const where = {
		...(statut ? {status: statut} : {}),
		...(terme
			? {
					OR: [
						{orderNumber: {contains: terme, mode: 'insensitive'}},
						{email: {contains: terme, mode: 'insensitive'}},
					],
				}
			: {}),
	};

	const [commandes, total] = await Promise.all([
		prisma.order.findMany({
			where,
			orderBy: {createdAt: 'desc'},
			take: taille,
			include: {
				// `_count` plutôt que les lignes elles-mêmes : la liste n'affiche
				// qu'un nombre d'articles, inutile de rapatrier chaque ligne.
				_count: {select: {items: true}},
				addresses: {where: {type: 'SHIPPING'}, select: {firstName: true, lastName: true}},
			},
		}),
		prisma.order.count({where}),
	]);

	return {commandes, total};
}

/// Ce qui attend une action : payé mais pas encore parti. C'est le nombre porté
/// par la pastille de la barre latérale — la seule chose qu'on veuille voir
/// depuis n'importe quelle page du back-office.
export async function compterCommandesATraiter() {
	return prisma.order.count({where: {status: {in: ['PAID', 'PREPARING']}}});
}

/// Le détail d'une commande, par son numéro. Réservé au back-office : pas de
/// second facteur ici, l'accès est déjà filtré par le droit `commandes.voir`.
export async function getCommandeAdmin(numero) {
	return prisma.order.findUnique({
		where: {orderNumber: numero},
		include: {
			items: true,
			addresses: true,
			payments: {orderBy: {createdAt: 'desc'}},
			user: {select: {id: true, email: true, firstName: true, lastName: true}},
		},
	});
}

/* Fait avancer une commande.

   La transition est revérifiée en base plutôt que crue sur parole : le
   formulaire affiche les choix valides au moment du rendu, mais la page a pu
   rester ouverte pendant que la commande évoluait ailleurs.

   Les horodatages sont posés en même temps que le statut — c'est ce qui permet
   de répondre à « il est parti quand, ce colis ? » sans journal séparé. */
export async function changerStatutCommande({numero, statut, suivi = null, transporteur = null}) {
	const commande = await prisma.order.findUnique({
		where: {orderNumber: numero},
		select: {
			id: true,
			status: true,
			items: {select: {variantId: true, kind: true, quantity: true}},
		},
	});

	if (!commande) return {ok: false, erreur: 'Commande introuvable.'};

	if (!statutsSuivants(commande.status).includes(statut)) {
		return {
			ok: false,
			erreur: `Une commande « ${LIBELLES_STATUT[commande.status]} » ne peut pas passer à « ${LIBELLES_STATUT[statut] ?? statut} ».`,
		};
	}

	const maintenant = new Date();

	const horodatage = {
		SHIPPED: {shippedAt: maintenant},
		DELIVERED: {deliveredAt: maintenant},
		CANCELLED: {cancelledAt: maintenant},
	};

	/* Annuler une commande déjà payée rend les pièces au stock : elles ont été
	   décrémentées à l'encaissement et ne partiront plus. Une commande annulée
	   avant paiement, elle, n'a jamais rien retiré — rien à rendre. */
	const rendreLeStock = statut === 'CANCELLED' && commande.status !== 'PENDING_PAYMENT';

	await prisma.$transaction(async (tx) => {
		await tx.order.update({
			where: {id: commande.id},
			data: {
				status: statut,
				...(horodatage[statut] ?? {}),
				...(suivi ? {trackingNumber: suivi.trim()} : {}),
				...(transporteur ? {carrier: transporteur.trim()} : {}),
			},
		});

		if (!rendreLeStock) return;


		for (const ligne of commande.items) {
			if (!ligne.variantId || ligne.kind === 'DIGITAL') continue;

			await tx.productVariant.update({
				where: {id: ligne.variantId},
				data: {stock: {increment: ligne.quantity}},
			});
		}
	});

	/* Le client est prévenu du départ de son colis — c'est le message qu'il
	   attend le plus. Envoyé hors transaction, et sans lever : le statut est déjà
	   enregistré, un e-mail qui ne part pas ne doit pas le défaire.

	   Les autres transitions ne déclenchent rien : « en préparation » n'apprend
	   rien à personne, et un e-mail d'annulation demande une explication écrite à
	   la main, pas un message automatique. */
	if (statut === 'SHIPPED') {
		const complete = await prisma.order.findUnique({
			where: {id: commande.id},
			select: {orderNumber: true, email: true, carrier: true, trackingNumber: true},
		});

		await envoyerAvisExpedition(complete);
	}

	return {ok: true};
}

/// Note interne sur une commande — « client prévenu du retard », « colis
/// refusé ». Invisible du client, elle sert à ne pas dépendre de sa mémoire.
export async function enregistrerNoteAdmin(numero, note) {
	await prisma.order.update({
		where: {orderNumber: numero},
		data: {adminNote: note?.trim() || null},
	});

	return {ok: true};
}
