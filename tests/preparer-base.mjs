/* Prépare la base de test.

   Les tests d'intégration écrivent réellement : ils créent des produits, des
   paniers, des commandes. Les faire tourner sur la base de développement
   mélangerait des données de test au catalogue en cours de saisie, et un test
   qui échoue au mauvais moment laisserait des restes.

   D'où une base séparée, `<base>_test`, créée ici puis migrée. Le script est
   idempotent : on peut le relancer autant qu'on veut.

   Lancé par `npm run test:preparer`. Sans lui, les tests d'intégration se
   sautent tout seuls et seuls les tests unitaires tournent. */

import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import pg from 'pg';

function urlDeDeveloppement() {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

	// Le .env n'est pas chargé automatiquement par Node : on le lit à la main
	// plutôt que d'ajouter une dépendance pour trois lignes.
	const contenu = readFileSync(new URL('../.env', import.meta.url), 'utf8');
	const trouve = contenu.match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)/m);

	if (!trouve) throw new Error('DATABASE_URL introuvable dans .env');

	return trouve[1];
}

const urlDev = new URL(urlDeDeveloppement());
const nomTest = `${urlDev.pathname.slice(1)}_test`;

const urlAdmin = new URL(urlDev);
urlAdmin.pathname = '/postgres';

const urlTest = new URL(urlDev);
urlTest.pathname = `/${nomTest}`;

const client = new pg.Client({connectionString: urlAdmin.toString()});
await client.connect();

const existe = await client.query('select 1 from pg_database where datname = $1', [nomTest]);

if (existe.rowCount === 0) {
	/* Le nom vient de la configuration locale, pas d'une saisie : il est
	   interpolé parce que PostgreSQL n'accepte pas de paramètre lié dans un
	   CREATE DATABASE. Les guillemets doubles le protègent. */
	await client.query(`create database "${nomTest}"`);
	console.log(`Base de test créée : ${nomTest}`);
} else {
	console.log(`Base de test déjà présente : ${nomTest}`);
}

await client.end();

// `migrate deploy` applique les migrations existantes sans jamais en générer :
// c'est la commande faite pour un environnement qu'on ne conçoit pas, on
// l'aligne.
execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
	stdio: 'inherit',
	shell: true,
	env: {...process.env, DATABASE_URL: urlTest.toString()},
});

console.log(`\nÀ mettre dans .env pour lancer les tests d'intégration :\nTEST_DATABASE_URL="${urlTest}"`);
