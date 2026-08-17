import {existsSync} from 'node:fs';
import {defineConfig} from 'prisma/config';

/* Configuration de la CLI Prisma (migrate, studio, db seed).
   Depuis Prisma 7, l'URL de connexion ne vit plus dans schema.prisma : elle est
   déclarée ici pour les migrations, et fournie séparément au client applicatif
   via l'adapter (voir src/server/db.js).

   Prisma ne lit plus le .env automatiquement non plus. On s'appuie sur le
   chargeur natif de Node plutôt que d'ajouter dotenv : une dépendance de moins.
   En production (Vercel, CI), DATABASE_URL vient de l'environnement et il n'y a
   pas de fichier .env — d'où le test d'existence. */

if (existsSync('.env')) {
	process.loadEnvFile('.env');
}

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		seed: 'node prisma/seed.js',
	},
	datasource: {
		url: process.env.DATABASE_URL,
	},
});
