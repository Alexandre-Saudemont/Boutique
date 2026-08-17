import {fileURLToPath} from 'node:url';
import {loadEnv} from 'vite';
import {defineConfig} from 'vitest/config';

/* Configuration des tests.

   Deux réglages seulement, mais qui demandent une explication.

   **L'alias `@`** reproduit celui de `jsconfig.json` : sans lui, un test qui
   importe `@/server/...` échouerait alors que le même import fonctionne dans
   l'application. Les tests doivent voir le code exactement comme Next le voit.

   **Le remplacement de `server-only`** : ce paquet lève volontairement quand il
   est chargé hors d'un environnement serveur Next, ce qui est précisément le
   cas ici. On lui substitue un module vide. Attention à ce que ça implique — ce
   garde-fou n'est plus vérifié pendant les tests ; c'est le build de Next qui
   reste juge de la frontière client/serveur. */
export default defineConfig({
	resolve: {
		alias: {
			'server-only': fileURLToPath(new URL('./tests/stubs/server-only.js', import.meta.url)),
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	test: {
		/* Les variables de `.env` sont chargées comme le ferait Next.

		   Ce n'est pas pour parler à la base : les tests unitaires n'ouvrent
		   aucune connexion. Mais importer un service importe `db.js`, qui refuse
		   de se construire sans `DATABASE_URL` — un refus volontaire, qu'on ne va
		   pas contourner en assouplissant le code applicatif pour les tests. */
		env: loadEnv('', process.cwd(), ''),
		environment: 'node',
		include: ['tests/**/*.test.js'],
		// Détourne la base vers celle de test avant tout import de service.
		setupFiles: ['tests/setup.js'],
		// Les tests d'intégration écrivent dans une base commune : les laisser
		// tourner en parallèle les ferait se marcher dessus.
		fileParallelism: false,
	},
});
