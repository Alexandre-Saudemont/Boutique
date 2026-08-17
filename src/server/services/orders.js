import 'server-only';
import {prisma} from '@/server/db';
import {envoyerAvisExpedition} from '@/server/email/messages';
import {statutApresExpedition} from '@/server/services/shipments';
import {dateCsv, montantCsv, versCsv} from '@/lib/csv';

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
	PARTIALLY_SHIPPED: 'Partiellement expédiée',
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
	/* On ne sort de « partiellement expédiée » qu'en expédiant le colis qui
	   reste, jamais par le menu des statuts. Laisser le choix ouvrirait la porte
	   à une commande marquée « expédiée » dont la précommande dort encore sur
	   l'étagère — et le client ne recevrait jamais son second avis d'expédition,
	   puisque c'est l'expédition du colis qui l'envoie. */
	PARTIALLY_SHIPPED: [],
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
			shipments: {orderBy: {position: 'asc'}, include: {items: true}},
		},
	});
}

/* Fait avancer une commande.

   La transition est revérifiée en base plutôt que crue sur parole : le
   formulaire affiche les choix valides au moment du rendu, mais la page a pu
   rester ouverte pendant que la commande évoluait ailleurs.

   Les horodatages sont posés en même temps que le statut — c'est ce qui permet
   de répondre à « il est parti quand, ce colis ? » sans journal séparé. */
export async function changerStatutCommande({numero, statut}) {
	const commande = await prisma.order.findUnique({
		where: {orderNumber: numero},
		select: {
			id: true,
			status: true,
			items: {select: {variantId: true, kind: true, quantity: true}},
			shipments: {select: {id: true, shippedAt: true}},
		},
	});

	if (!commande) return {ok: false, erreur: 'Commande introuvable.'};

	if (!statutsSuivants(commande.status).includes(statut)) {
		return {
			ok: false,
			erreur: `Une commande « ${LIBELLES_STATUT[commande.status]} » ne peut pas passer à « ${LIBELLES_STATUT[statut] ?? statut} ».`,
		};
	}

	/* « Expédiée » ne se décrète pas quand il reste des colis à envoyer.

	   Le menu des statuts garde l'entrée pour les commandes qui n'ont rien à
	   expédier — un ouvrage numérique, par exemple. Sur une commande qui a des
	   colis, c'est l'expédition de chacun qui fait avancer le statut : la poser à
	   la main sauterait l'avis d'expédition que le client attend. */
	if (statut === 'SHIPPED') {
		const enAttente = commande.shipments.filter((colis) => !colis.shippedAt);

		if (enAttente.length > 0) {
			return {
				ok: false,
				erreur:
					enAttente.length === commande.shipments.length
						? 'Expédiez le colis depuis la fiche : c’est ce qui prévient le client.'
						: `Il reste ${enAttente.length} colis à expédier sur cette commande.`,
			};
		}
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
			data: {status: statut, ...(horodatage[statut] ?? {})},
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

	/* Aucune de ces transitions n'envoie d'e-mail.

	   L'avis d'expédition part désormais à l'expédition de chaque colis, dans
	   `expedierColis` — c'est le seul moment où l'on sait quoi annoncer et quel
	   numéro de suivi donner. « En préparation » n'apprend rien à personne, et un
	   message d'annulation demande une explication écrite à la main. */
	return {ok: true};
}

/* Expédie un colis.
 *
 * C'est le geste du quotidien : ton ami colle l'étiquette, saisit le numéro de
 * suivi, et le client reçoit son avis de départ. Sur une commande scindée, il
 * le fait deux fois — en août pour ce qui était en stock, en octobre pour la
 * précommande.
 *
 * Le statut de la commande n'est pas donné par l'appelant mais déduit des colis
 * qui restent : c'est ce qui garantit qu'une commande ne peut pas être marquée
 * « expédiée » alors qu'un paquet dort encore sur l'étagère. */
export async function expedierColis({numero, colisId, suivi = null, transporteur = null, url = null}) {
	const commande = await prisma.order.findUnique({
		where: {orderNumber: numero},
		select: {
			id: true,
			status: true,
			orderNumber: true,
			email: true,
			shipments: {select: {id: true, position: true, label: true, shippedAt: true}},
		},
	});

	if (!commande) return {ok: false, erreur: 'Commande introuvable.'};

	// On n'expédie pas ce qui n'est pas payé, ni ce qui est annulé.
	if (!['PAID', 'PREPARING', 'PARTIALLY_SHIPPED'].includes(commande.status)) {
		return {
			ok: false,
			erreur: `Une commande « ${LIBELLES_STATUT[commande.status]} » ne s’expédie pas.`,
		};
	}

	const colis = commande.shipments.find((envoi) => envoi.id === colisId);

	if (!colis) return {ok: false, erreur: 'Colis introuvable sur cette commande.'};
	if (colis.shippedAt) return {ok: false, erreur: 'Ce colis est déjà parti.'};

	const maintenant = new Date();

	/* L'état des colis après celui-ci — calculé sur la liste relue, avec le colis
	   courant marqué parti. Interroger la base après coup donnerait le même
	   résultat mais ferait un aller-retour de plus pour une information qu'on a
	   déjà sous la main. */
	const apres = commande.shipments.map((envoi) =>
		envoi.id === colisId ? {...envoi, shippedAt: maintenant} : envoi,
	);

	const statut = statutApresExpedition(apres);

	await prisma.$transaction(async (tx) => {
		await tx.shipment.update({
			where: {id: colisId},
			data: {
				shippedAt: maintenant,
				...(suivi ? {trackingNumber: suivi.trim()} : {}),
				...(transporteur ? {carrier: transporteur.trim()} : {}),
				...(url ? {trackingUrl: url.trim()} : {}),
			},
		});

		await tx.order.update({
			where: {id: commande.id},
			data: {
				status: statut,
				// La commande n'est datée « expédiée » que lorsque le dernier colis
				// est parti : c'est cette date que lit le suivi de délai.
				...(statut === 'SHIPPED' ? {shippedAt: maintenant} : {}),
			},
		});
	});

	/* Hors transaction et sans lever : l'expédition est enregistrée, un e-mail
	   qui ne part pas ne doit pas la défaire. */
	await envoyerAvisExpedition(
		{orderNumber: commande.orderNumber, email: commande.email},
		{
			position: colis.position,
			label: colis.label,
			carrier: transporteur ?? null,
			trackingNumber: suivi ?? null,
			trackingUrl: url ?? null,
			total: commande.shipments.length,
		},
	);

	return {ok: true, statut};
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

// ============================================================
// LIVRE DES RECETTES
// ============================================================

/* Ce qu'une micro-entreprise doit tenir, et pourquoi ce n'est pas un export
   de la base.

   L'obligation comptable du régime micro est le livre des recettes : une ligne
   par encaissement, dans l'ordre chronologique, portant la date, la référence
   de la pièce, l'identité du client, le montant et le mode de règlement. Rien
   de plus — et surtout rien qu'on puisse réécrire après coup.

   D'où deux choix qui expliquent tout le reste de ce module.

   La date retenue est `paidAt`, jamais `createdAt`. Le régime micro est un
   régime de caisse : ce qui compte est l'encaissement, pas l'émission. Une
   commande passée le 31 décembre et payée le 2 janvier appartient à l'exercice
   suivant, et se tromper là-dessus fausse deux déclarations d'un coup.

   Le critère d'inclusion est `paidAt` non nul, et non le statut. Les statuts
   bougent — une commande payée puis remboursée devient REFUNDED, une expédiée
   devient livrée — alors que l'encaissement, lui, a eu lieu. Filtrer sur le
   statut ferait disparaître du livre des recettes réellement perçues, ce qui
   est exactement ce qu'un contrôle cherche. Les paniers abandonnés et les
   commandes annulées avant paiement n'ont jamais de `paidAt` : ils sortent
   d'eux-mêmes, sans qu'on ait à les nommer. */

/* Les moyens de règlement, écrits comme sur le relevé.

   PayPal est encaissé par Stripe et enregistré en STRIPE (voir `payments.js`) :
   du point de vue du livre, l'argent vient bien de Stripe, et c'est ce qu'il
   faut pouvoir rapprocher des versements reçus sur le compte. */
const LIBELLES_REGLEMENT = {
	STRIPE: 'Carte bancaire (Stripe)',
	PAYPAL: 'PayPal',
};

/* L'exercice auquel appartient un encaissement, vu de France.

   Les dates sont stockées en UTC ; l'exercice, lui, est français. Un paiement
   du 1er janvier à 00 h 30 heure de Paris est enregistré le 31 décembre à
   23 h 30 UTC : lu naïvement, il tomberait dans l'exercice précédent, alors que
   le client le verra daté du 1er janvier sur son relevé. Deux déclarations
   fausses pour une commande de nuit du réveillon. */
const ANNEE_PARIS = new Intl.DateTimeFormat('fr-FR', {
	timeZone: 'Europe/Paris',
	year: 'numeric',
});

function anneeFiscale(date) {
	return Number(ANNEE_PARIS.format(date));
}

/* Les bornes d'un exercice, en instants UTC.

   Janvier est toujours en heure d'hiver, soit UTC+1 : l'exercice commence donc
   le 31 décembre précédent à 23 h UTC. Pas de calcul d'heure d'été à faire ici,
   les deux bornes tombent du même côté du changement. */
function bornesExercice(annee) {
	return {
		debut: new Date(Date.UTC(annee - 1, 11, 31, 23)),
		finExclue: new Date(Date.UTC(annee, 11, 31, 23)),
	};
}

/* Les exercices sur lesquels il existe quelque chose à déclarer.

   Sert à ne proposer dans le back-office que des années réellement remplies :
   un menu qui offre 2019 sur une boutique ouverte en 2026 fait douter de tout
   le reste du fichier. */
export async function exercicesDeRecettes() {
	const encaissements = await prisma.order.findMany({
		where: {paidAt: {not: null}},
		select: {paidAt: true},
		orderBy: {paidAt: 'desc'},
	});

	return [...new Set(encaissements.map((commande) => anneeFiscale(commande.paidAt)))];
}

/* Le livre d'un exercice, prêt à être écrit dans un tableur.

   Renvoie les lignes et leurs totaux plutôt qu'un fichier : la mise en forme
   CSV appartient à `@/lib/csv`, et les totaux servent aussi à l'écran.

   Le remboursement occupe sa propre colonne au lieu d'être soustrait de la
   recette. Un remboursement est un mouvement daté, souvent sur un autre
   exercice que l'encaissement ; le fondre dans le montant perçu effacerait à la
   fois la recette et sa contrepartie, et le livre ne collerait plus au relevé
   bancaire. */
export async function livreDesRecettes(annee) {
	const {debut, finExclue} = bornesExercice(annee);

	const commandes = await prisma.order.findMany({
		where: {paidAt: {gte: debut, lt: finExclue}},
		orderBy: {paidAt: 'asc'},
		include: {
			payments: {
				where: {status: {in: ['SUCCEEDED', 'REFUNDED']}},
				orderBy: {createdAt: 'asc'},
			},
			addresses: true,
		},
	});

	const lignes = commandes.map((commande) => {
		const reglement = commande.payments[0];

		/* Le nom qui figure sur la facture, et pas celui du compte : l'adresse
		   de facturation est une copie figée à la commande, alors qu'un client
		   peut avoir changé de nom — ou avoir demandé l'effacement de son
		   compte depuis. Le livre doit rester lisible dans dix ans. */
		const facturation =
			commande.addresses.find((adresse) => adresse.type === 'BILLING') ?? commande.addresses[0];

		const client = [facturation?.firstName, facturation?.lastName].filter(Boolean).join(' ');

		return {
			date: commande.paidAt,
			numero: commande.orderNumber,
			client: client || commande.email,
			email: commande.email,
			reglement: LIBELLES_REGLEMENT[reglement?.provider] ?? 'Non renseigné',
			produitsCents: commande.subtotalCents - commande.discountCents,
			portCents: commande.shippingCents,
			tvaCents: commande.vatCents,
			totalCents: commande.totalCents,
			rembourseCents: reglement?.refundedCents ?? 0,
			franchiseTva: commande.vatRegime === 'FRANCHISE',
			statut: LIBELLES_STATUT[commande.status],
		};
	});

	const totaux = lignes.reduce(
		(somme, ligne) => ({
			encaisseCents: somme.encaisseCents + ligne.totalCents,
			rembourseCents: somme.rembourseCents + ligne.rembourseCents,
		}),
		{encaisseCents: 0, rembourseCents: 0},
	);

	return {
		annee,
		lignes,
		totaux: {...totaux, netCents: totaux.encaisseCents - totaux.rembourseCents},
	};
}

/* Le même livre, en CSV.

   La ligne de totaux est incluse, séparée par une ligne vide. C'est ce que le
   comptable attend d'un livre de recettes, et ça évite au client de refaire la
   somme à la main — donc de se tromper. */
export async function livreDesRecettesEnCsv(annee) {
	const {lignes, totaux} = await livreDesRecettes(annee);

	const enTete = [
		'Date d’encaissement',
		'N° de commande',
		'Client',
		'E-mail',
		'Mode de règlement',
		'Produits (€)',
		'Livraison (€)',
		'TVA (€)',
		'Total encaissé (€)',
		'Remboursé (€)',
		'Régime TVA',
		'Statut',
	];

	const corps = lignes.map((ligne) => [
		dateCsv(ligne.date),
		ligne.numero,
		ligne.client,
		ligne.email,
		ligne.reglement,
		montantCsv(ligne.produitsCents),
		montantCsv(ligne.portCents),
		montantCsv(ligne.tvaCents),
		montantCsv(ligne.totalCents),
		montantCsv(ligne.rembourseCents),
		ligne.franchiseTva ? 'Franchise en base (art. 293 B du CGI)' : 'TVA applicable',
		ligne.statut,
	]);

	const pied = [
		[],
		[
			`Total ${annee}`,
			'',
			'',
			'',
			'',
			'',
			'',
			'',
			montantCsv(totaux.encaisseCents),
			montantCsv(totaux.rembourseCents),
			'',
			'',
		],
		[`Recettes nettes ${annee}`, montantCsv(totaux.netCents)],
	];

	return versCsv([enTete, ...corps, ...pied]);
}
