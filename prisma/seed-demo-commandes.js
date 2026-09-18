import {existsSync} from 'node:fs';
import prismaClient from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';

/* Commandes de démonstration — développement uniquement.

   Sert à voir les bandeaux de couleur sur une vraie liste, avec les huit
   statuts représentés plusieurs fois chacun. Séparé de `seed-demo.js` (qui ne
   pose que le catalogue) : celui-ci n'a aucune raison de tourner ailleurs
   qu'en local, le temps de juger un rendu à l'écran.

   Lancer avec : node prisma/seed-demo-commandes.js
   Refuse de tourner en production, comme `seed-demo.js`.

   Ré-exécutable sans accumuler : toute commande dont le numéro commence par
   `DEMO-` est effacée puis recréée à chaque lancement — le préfixe suffit à
   les distinguer sans ambiguïté d'une vraie commande (`AVGF-…`). */

if (existsSync('.env')) {
	process.loadEnvFile('.env');
}

if (process.env.NODE_ENV === 'production') {
	console.error('Refus : ce seed de démonstration ne doit pas tourner en production.');
	process.exit(1);
}

const {PrismaClient} = prismaClient;

const prisma = new PrismaClient({
	adapter: new PrismaPg({connectionString: process.env.DATABASE_URL}),
});

const STATUTS = [
	'PENDING_PAYMENT',
	'PAID',
	'PREPARING',
	'PARTIALLY_SHIPPED',
	'SHIPPED',
	'DELIVERED',
	'CANCELLED',
	'REFUNDED',
];

const CLIENTS = [
	['Manon', 'Duval'],
	['Léo', 'Moreau'],
	['Sofia', 'Nguyen'],
	['Adam', 'Petit'],
	['Romane', 'Faure'],
	['Camille', 'Blanc'],
	['Hugo', 'Girard'],
	['Pauline', 'Lemoine'],
	['Nathan', 'Roy'],
	['Zoé', 'Fontaine'],
	['Enzo', 'Vidal'],
	['Alice', 'Perrin'],
];

// Un horodatage cohérent avec le statut : une commande « livrée » a forcément
// été payée et expédiée avant, une commande « annulée » ou « remboursée »
// peut l'avoir été à n'importe quel stade — ici, après paiement, le cas le
// plus courant en boutique.
function horodatages(statut, placeeLe) {
	const heure = (jours) => new Date(placeeLe.getTime() + jours * 86_400_000);

	switch (statut) {
		case 'PENDING_PAYMENT':
			return {};
		case 'PAID':
			return {paidAt: heure(0)};
		case 'PREPARING':
			return {paidAt: heure(0)};
		case 'PARTIALLY_SHIPPED':
			return {paidAt: heure(0), shippedAt: heure(1)};
		case 'SHIPPED':
			return {paidAt: heure(0), shippedAt: heure(1)};
		case 'DELIVERED':
			return {paidAt: heure(0), shippedAt: heure(1), deliveredAt: heure(3)};
		case 'CANCELLED':
			return {paidAt: heure(0), cancelledAt: heure(1)};
		case 'REFUNDED':
			return {paidAt: heure(0), cancelledAt: heure(2)};
		default:
			return {};
	}
}

async function main() {
	const effacees = await prisma.order.deleteMany({where: {orderNumber: {startsWith: 'DEMO-'}}});
	console.info(`${effacees.count} commande(s) de démonstration précédente(s) effacée(s).`);

	let rang = 1;
	const maintenant = Date.now();

	for (const statut of STATUTS) {
		for (let i = 0; i < 3; i += 1) {
			const [prenom, nom] = CLIENTS[(rang - 1) % CLIENTS.length];
			const orderNumber = `DEMO-2026-${String(rang).padStart(4, '0')}`;
			// Étalées sur les deux dernières semaines, pour que la liste ne montre
			// pas huit commandes passées à la même seconde.
			const placeeLe = new Date(maintenant - rang * 6 * 3_600_000);

			const sousTotal = 2900 + rang * 350;
			const port = 590;
			const total = sousTotal + port;

			await prisma.order.create({
				data: {
					orderNumber,
					email: `${prenom.toLowerCase()}.${nom.toLowerCase()}@exemple.fr`,
					status: statut,
					vatRegime: 'FRANCHISE',
					subtotalCents: sousTotal,
					shippingCents: port,
					totalCents: total,
					placedAt: placeeLe,
					createdAt: placeeLe,
					shippingMethod: 'Colissimo à domicile',
					...horodatages(statut, placeeLe),
					addresses: {
						create: [
							{
								type: 'SHIPPING',
								firstName: prenom,
								lastName: nom,
								line1: `${10 + rang} rue des Geeks`,
								postalCode: '59000',
								city: 'Lille',
								country: 'FR',
							},
						],
					},
					items: {
						create: [
							{
								productName: 'Rônin des Cerisiers — 1/7',
								variantName: 'Standard',
								sku: `DEMO-SKU-${rang}`,
								kind: 'PHYSICAL',
								unitPriceCents: sousTotal,
								quantity: 1,
								totalCents: sousTotal,
							},
						],
					},
				},
			});

			rang += 1;
		}
	}

	console.info(`${rang - 1} commande(s) de démonstration créée(s), toutes préfixées DEMO-.`);
}

main()
	.catch((erreur) => {
		console.error(erreur);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
