import 'server-only';
import {prisma} from '@/server/db';

/* Rayons du catalogue.

   Ils alimentent le menu « Rayons » du header, le footer et les filtres de la
   boutique. Un rayon désactivé disparaît de la vitrine sans être supprimé :
   les produits qui le référencent gardent leur fil d'Ariane intact. */

/// Les rayons de premier niveau, dans l'ordre voulu par le client.
export async function getRayons() {
	return prisma.category.findMany({
		where: {parentId: null, isActive: true},
		orderBy: [{position: 'asc'}, {name: 'asc'}],
		select: {
			id: true,
			name: true,
			slug: true,
			description: true,
			imageUrl: true,
		},
	});
}

/// Un rayon et ses sous-rayons, par slug. `null` si inconnu ou désactivé —
/// à la charge de l'appelant d'en faire un 404.
export async function getRayonBySlug(slug) {
	return prisma.category.findFirst({
		where: {slug, isActive: true},
		include: {
			children: {
				where: {isActive: true},
				orderBy: [{position: 'asc'}, {name: 'asc'}],
			},
			parent: {select: {name: true, slug: true}},
		},
	});
}
