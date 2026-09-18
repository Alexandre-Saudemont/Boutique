/* Préparation commune à tous les tests.

   Deux détournements, capitaux tous les deux : si `TEST_DATABASE_URL` existe,
   elle devient la `DATABASE_URL` du processus. Les services importent le
   client Prisma sans savoir qu'ils sont testés — c'est bien ainsi, ils n'ont
   pas à le savoir — et c'est donc ici, avant leur import, que la cible doit
   être détournée.

   Sans `TEST_DATABASE_URL`, rien ne bouge : les tests d'intégration se sautent
   d'eux-mêmes et les tests unitaires, qui ne touchent pas la base, tournent
   normalement. Aucun test n'écrira jamais dans la base de développement. */

if (process.env.TEST_DATABASE_URL) {
	process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

/* Les tests ne doivent jamais faire partir un e-mail réel.

   `vitest.config.js` charge `.env` comme le ferait Next — y compris
   `RESEND_API_KEY` et `EMAIL_FROM`, la vraie clé de production. Un test de
   commande, d'inscription ou de mot de passe oublié appelle le même code que
   la boutique en vrai, donc sans ce garde-fou, chaque passage de la suite
   déclenchait un envoi réel chez Resend — jusqu'à faire sauter le quota
   quotidien du compte du client.

   `envoyerEmail` (voir `src/server/email/transport.js`) se rabat sur la
   console dès que l'une des deux variables manque : effacer les deux ici
   suffit à couper l'envoi partout, sans toucher au code applicatif. */
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;
