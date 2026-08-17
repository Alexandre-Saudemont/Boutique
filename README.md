# L'antre du vieux geek fou

Boutique en ligne de pop culture — figurines, mangas, jeux de société, JDR,
goodies, box surprises et Ichiban Kuji. Développée sur mesure pour un ami en
micro-entreprise.

## La pile technique

- **Next.js 16** (App Router) et **React 19**, en JavaScript
- **Prisma 7** et **PostgreSQL**
- **CSS Modules**, sur les tokens du design system « Organic »
- **Stripe** pour l'encaissement — carte bancaire et PayPal
- **Vitest** pour les tests

## Ce que le site fait

Catalogue avec déclinaisons, recherche et filtres · panier visiteur rattaché au
compte à la connexion · tunnel de commande en trois étapes · frais de port
paramétrables · codes promotionnels · vente d'ouvrages numériques à lien
expirant · box surprises · comptes clients avec vérification d'adresse ·
avis modérés · blog · newsletter à double confirmation.

Côté administration : tableau de bord, gestion du catalogue et des commandes,
fiches clients, modération, promotions, livraison, mise en avant sur la vitrine,
livre des recettes exportable par exercice, et journal des actions.

## Démarrer

```bash
npm install
cp .env.example .env      # puis renseigner les valeurs
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## Tests

```bash
npm test                  # tests unitaires, sans base
npm run test:preparer     # prépare la base de test, puis relancer npm test
```

Les tests d'intégration se sautent d'eux-mêmes tant que `TEST_DATABASE_URL`
est absente. Aucun test n'écrit jamais dans la base de développement.

## Documentation

| Fichier | Contenu |
| --- | --- |
| `CLAUDE.md` | Conventions du projet et règles d'architecture |
| `docs/MODELE-DONNEES.md` | Schéma commenté et décisions structurantes |
| `docs/CONNEXION-ET-RENDU.md` | Sessions, et où le code s'exécute |
| `docs/AUDIT-SECURITE.md` | État de la sécurité |
| `docs/MISE-EN-LIGNE.md` | Déploiement, dans l'ordre |
| `docs/PAGES-DE-CONTENU.md` | Les pages de contenu et ce qui reste à fournir |

---

Historique : ce dépôt a d'abord porté une architecture Express avec un front
séparé. Elle a été remplacée par l'application Next actuelle ; les commits
correspondants restent consultables dans l'historique.
