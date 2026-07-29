import 'server-only';
import {PrismaClient} from '@prisma/client';

/* Client Prisma partagé.
   En développement, Next recharge les modules à chaque modification de fichier.
   Sans ce cache sur globalThis, chaque rechargement créerait un nouveau client
   et donc un nouveau pool de connexions — Postgres finit par refuser les
   connexions au bout de quelques minutes de travail. */

const globalForPrisma = globalThis;

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
	});

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}
