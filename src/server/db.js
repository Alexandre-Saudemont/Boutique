import 'server-only';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';

/* Client Prisma partagé.

   Depuis Prisma 7, la connexion passe par un driver adapter plutôt que par
   l'URL du schéma : c'est le pilote `pg` qui parle à Postgres, Prisma se
   contente de compiler les requêtes.

   Le cache sur globalThis existe pour le développement : Next recharge les
   modules à chaque modification de fichier, et sans lui chaque rechargement
   ouvrirait un nouveau pool de connexions. Postgres finit par les refuser au
   bout de quelques minutes de travail. */

const globalForPrisma = globalThis;

function createPrismaClient() {
	if (!process.env.DATABASE_URL) {
		throw new Error(
			'DATABASE_URL est absente. Renseignez-la dans .env (développement) ou dans les variables d’environnement (production).',
		);
	}

	return new PrismaClient({
		adapter: new PrismaPg({connectionString: process.env.DATABASE_URL}),
		log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
	});
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}
