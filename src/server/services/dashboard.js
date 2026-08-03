import 'server-only';
import {prisma} from '@/server/db';

/* Les chiffres du tableau de bord.

   Une règle tient tout ce fichier : **le chiffre d'affaires ne compte que les
   commandes encaissées**. Une commande en attente de paiement n'est pas une
   vente, et l'afficher comme telle donnerait un chiffre flatteur et faux — sur
   lequel se prennent de mauvaises décisions d'achat.

   Les commandes annulées et remboursées sortent du total pour la même raison.

   Tout est calculé par PostgreSQL (`aggregate`, `count`) plutôt qu'en
   rapatriant les lignes pour les additionner en JavaScript : la base sait le
   faire, et le coût ne bouge pas quand le catalogue grandit. */

const STATUTS_ENCAISSES = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'];

/// Minuit aujourd'hui, heure du serveur. Le « chiffre du jour » d'un commerçant
/// commence à minuit, pas vingt-quatre heures en arrière.
function debutDuJour() {
	const date = new Date();
	date.setHours(0, 0, 0, 0);
	return date;
}

function debutIlYaNJours(jours) {
	const date = debutDuJour();
	date.setDate(date.getDate() - jours);
	return date;
}

/* Le seuil d'alerte est porté par chaque variante (`lowStockThreshold`) et non
   par une valeur globale : trois pièces d'une figurine à 90 € et trois d'un
   porte-clés à 4 € n'appellent pas la même réaction. La comparaison se fait de
   colonne à colonne, côté base. */
const STOCK_SOUS_LE_SEUIL = {lte: prisma.productVariant.fields.lowStockThreshold};

export async function getChiffresTableauDeBord({avecFinances = true} = {}) {
	const aujourdHui = debutDuJour();
	const semaine = debutIlYaNJours(7);

	const [caJour, caSemaine, aPreparer, aExpedier, enAttentePaiement, stockBas, abonnes] =
		await Promise.all([
			prisma.order.aggregate({
				_sum: {totalCents: true},
				_count: true,
				where: {status: {in: STATUTS_ENCAISSES}, paidAt: {gte: aujourdHui}},
			}),
			prisma.order.aggregate({
				_sum: {totalCents: true},
				_count: true,
				where: {status: {in: STATUTS_ENCAISSES}, paidAt: {gte: semaine}},
			}),
			prisma.order.count({where: {status: 'PAID'}}),
			prisma.order.count({where: {status: 'PREPARING'}}),
			prisma.order.count({where: {status: 'PENDING_PAYMENT'}}),
			prisma.productVariant.findMany({
				where: {
					stock: STOCK_SOUS_LE_SEUIL,
					isActive: true,
					archivedAt: null,
					product: {archivedAt: null, isActive: true},
				},
				orderBy: {stock: 'asc'},
				take: 6,
				select: {
					id: true,
					name: true,
					stock: true,
					lowStockThreshold: true,
					product: {select: {name: true, slug: true}},
				},
			}),
			// Confirmés seulement : c'est le nombre de personnes que la lettre
			// atteindra, pas celui des adresses saisies.
			prisma.newsletterSubscriber.count({
				where: {unsubscribedAt: null, confirmedAt: {not: null}},
			}),
		]);

	return {
		// `_sum` vaut `null` tant qu'aucune ligne ne correspond : le premier jour
		// d'ouverture afficherait « null € » sans ce repli.
		caJourCents: avecFinances ? (caJour._sum.totalCents ?? 0) : null,
		caSemaineCents: avecFinances ? (caSemaine._sum.totalCents ?? 0) : null,
		commandesJour: caJour._count,
		commandesSemaine: caSemaine._count,
		aPreparer,
		aExpedier,
		enAttentePaiement,
		stockBas,
		abonnes,
	};
}

/// Les dernières commandes, pour l'aperçu du tableau de bord. La liste complète
/// vit dans `orders.js` — ici on ne veut que de quoi remplir six lignes.
export async function getDernieresCommandes(limite = 6) {
	return prisma.order.findMany({
		orderBy: {createdAt: 'desc'},
		take: limite,
		select: {
			orderNumber: true,
			email: true,
			status: true,
			totalCents: true,
			createdAt: true,
		},
	});
}
