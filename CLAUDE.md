# L'antre du vieux geek fou

Boutique en ligne de pop culture (figurines, mangas, jeux de société, JDR, goodies,
box surprises, Ichiban Kuji). Micro-entreprise, franchise en base de TVA.

## Stack

- **Next.js 16** (App Router), **React 19**, **JavaScript** — pas de TypeScript, jamais.
- **Prisma 7** + PostgreSQL.
- **CSS Modules** + les tokens du design system Organic. Pas de Tailwind.
- **lucide-react** pour les icônes (`strokeWidth={2.75}`, imposé par le design).

## La règle d'or : `src/server` ↔ `src/app`

Le projet est **une seule app Next**, mais le back et le front restent séparés :

| Dossier        | Rôle                                          | Interdit                                    |
| -------------- | --------------------------------------------- | ------------------------------------------- |
| `src/server/`  | Back : Prisma, services métier, auth, session | Ne renvoie jamais de JSX. Jamais importé par un composant `'use client'`. |
| `src/app/`     | Front : pages, layouts, routes                | N'appelle jamais Prisma directement. Passe par un service. |
| `src/components/` | Composants d'interface réutilisables       | Idem : jamais de Prisma.                    |

Tout fichier de `src/server/` commence par `import 'server-only'` — un import
depuis le client fait échouer le build au lieu de fuiter du code serveur.

**Ce qui remplace Express :** un service exporte une fonction qui `return` des
données (au lieu d'un contrôleur qui fait `res.json()`). Une page Server Component
l'appelle directement en `await` — pas de `fetch`, pas de HTTP, pas de CORS.
`src/app/api/` n'existe que pour les clients externes qui ont besoin de vraies
routes HTTP : webhooks Stripe et PayPal.

## Arborescence

```
prisma/schema.prisma      Schéma de référence — voir docs/MODELE-DONNEES.md
src/server/db.js          Client Prisma partagé (singleton)
src/server/services/      Logique métier : produits, panier, commandes…
src/server/auth/          Sessions et contrôle des rôles
src/app/(site)/           Vitrine — layout avec header/footer
src/app/(admin)/          Back-office — layout sombre à sidebar
src/app/api/              Webhooks uniquement
src/components/           Composants d'interface
src/styles/organic.css    Tokens du design system — copié du handoff, ne pas retoucher
src/styles/globals.css    Styles globaux du site
```

Les parenthèses de `(site)` et `(admin)` sont des **groupes de routes** Next :
elles n'apparaissent pas dans l'URL, elles servent à donner deux layouts distincts.

## Conventions

- **Argent : jamais de `Float`.** Tous les montants sont des `Int` en centimes
  (`priceCents`). `0.1 + 0.2 !== 0.3` produit des totaux faux en caisse.
- **Identifiants : `cuid()`**, pas d'auto-incrément — un `/produit/47` annonce
  publiquement qu'il y a 47 produits et se parcourt à la main.
- **Suppression : `archivedAt`**, jamais de `DELETE` sur un produit ou un compte
  lié à une commande. L'historique de facturation doit rester intact.
- **Commandes : tout est figé.** Adresses et lignes sont des copies, jamais des
  références. Un prix qui change ne doit pas réécrire une facture passée.
- **Design : jamais de hex ni de px en dur** quand un token existe. Couleurs,
  espacements, rayons et ombres viennent tous de `organic.css`.
- **Contraste** : pour du texte courant en terracotta, utiliser `--color-accent-700`.
  L'accent brut ne monte qu'à ~3:1 et ne passe pas en texte.
- **Français partout** : interface, contenu, commentaires. Ton chaleureux et
  personnel, à la première personne (« le Vieux geek » parle au visiteur).

## Tests

`npm test` (Vitest). Deux familles, dans `tests/` :

- **`tests/unite/`** — sans base : hachage, droits, limitation de tentatives,
  validation, conversion des prix, export CSV. Tourne partout, en quelques
  secondes.
- **`tests/integration/`** — contre un vrai PostgreSQL : isolation des paniers,
  tunnel de commande, transitions de statut, catalogue. **Ils se sautent tout
  seuls** si `TEST_DATABASE_URL` est absente.

Pour les activer une première fois : `npm run test:preparer` crée
`<base>_test`, y applique les migrations et affiche la ligne à coller dans
`.env`. Aucun test n'écrit jamais dans la base de développement — `tests/setup.js`
détourne `DATABASE_URL`, et les tests d'intégration vérifient que la cible se
termine par `_test` avant de vider quoi que ce soit.

**Tout garde-fou de sécurité se double d'un test.** C'est ce qui empêche qu'une
modification distraite retire un contrôle sans que rien ne proteste.

## Références

- `docs/CONNEXION-ET-RENDU.md` — comment marche la connexion, et où le code
  s'exécute (Server Components, Server Actions, la frontière client/serveur).
- `docs/AUDIT-SECURITE.md` — état de la sécurité, ce qui est traité, ce qui reste.
- `docs/MISE-EN-LIGNE.md` — déploiement de zéro, dans l'ordre, et ce qui casse
  si on saute une étape.
- `docs/MODELE-DONNEES.md` — schéma de données commenté et décisions structurantes.
- `docs/PAGES-DE-CONTENU.md` — les sept pages de contenu, les écarts assumés à
  la maquette, et ce que le client doit encore fournir.
- `docs/QUESTIONS-CLIENT.md` — points en attente de réponse du client.
- Handoff design : `C:\Users\alexa\Downloads\design_handoff_antre_geek`
  (`README.md` décrit les 15 écrans, `preview_html/` montre le rendu réel).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
