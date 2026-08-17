/* Préparation commune à tous les tests.

   Une seule chose, mais capitale : si `TEST_DATABASE_URL` existe, elle devient
   la `DATABASE_URL` du processus. Les services importent le client Prisma sans
   savoir qu'ils sont testés — c'est bien ainsi, ils n'ont pas à le savoir — et
   c'est donc ici, avant leur import, que la cible doit être détournée.

   Sans `TEST_DATABASE_URL`, rien ne bouge : les tests d'intégration se sautent
   d'eux-mêmes et les tests unitaires, qui ne touchent pas la base, tournent
   normalement. Aucun test n'écrira jamais dans la base de développement. */

if (process.env.TEST_DATABASE_URL) {
	process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
