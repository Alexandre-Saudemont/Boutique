import 'server-only';
import {prisma} from '@/server/db';

/* Livraison.

   Les tarifs vivent en base et non dans le code : le client change de
   transporteur ou ajuste un prix depuis l'admin, sans redéploiement. Le franco
   de port est porté par chaque tarif (`freeAboveCents`) plutôt que par un
   réglage global, parce qu'il peut différer d'un mode à l'autre — le retrait à
   l'atelier est gratuit d'emblée, le relais et le domicile ont leur propre
   seuil. */

/// Les modes de livraison proposés, pour l'affichage. Le calcul réel des frais
/// se fera au tunnel de commande, en fonction du poids et de la destination.
export async function getModesLivraison() {
	const tarifs = await prisma.shippingRate.findMany({
		where: {isActive: true, zone: {isActive: true}},
		orderBy: [{position: 'asc'}, {priceCents: 'asc'}],
		select: {
			id: true,
			name: true,
			carrier: true,
			priceCents: true,
			freeAboveCents: true,
			estimatedDays: true,
			isRelayPoint: true,
		},
	});

	return tarifs;
}
