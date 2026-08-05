# Mettre la boutique en ligne

Ce document décrit le déploiement de zéro, dans l'ordre, avec ce qui casse si
on saute une étape. Il est écrit pour être suivi par quelqu'un qui n'a pas
construit le site — et pour être relu dans six mois quand plus personne ne se
souviendra de rien.

**Rien ici n'est automatique.** Chaque étape se fait à la main, une fois.

---

## 1. Ce qu'il faut avoir avant de commencer

| Quoi | Pourquoi | Sans lui |
| --- | --- | --- |
| Une base **PostgreSQL** | Tout y est stocké | Le site ne démarre pas |
| Un **domaine** | Les liens des e-mails et les retours de paiement sont absolus | Les liens envoyés aux clients ne mènent nulle part |
| Un compte **Stripe** | Encaissement | La commande s'enregistre, le paiement se règle à la main |
| Un compte **Resend** + domaine vérifié | E-mails transactionnels | Aucun message ne part, les textes s'écrivent dans la console |
| Un **volume persistant** | Fichiers des ouvrages numériques | Les fichiers vendus disparaissent au redéploiement suivant |

Les trois derniers ne bloquent pas la mise en ligne : le site fonctionne sans
eux et le dit franchement à l'écran. Ils bloquent la **vente**.

---

## 2. Les variables d'environnement

À renseigner chez l'hébergeur, jamais dans un fichier versionné. Le détail de
chacune est commenté dans `.env.example`, qui fait référence.

### Obligatoires

```
DATABASE_URL="postgresql://…"
NEXT_PUBLIC_SITE_URL="https://antreduvieuxgeekfou.fr"
```

`NEXT_PUBLIC_SITE_URL` est facultative en théorie — l'adresse se déduit des
en-têtes de la requête. En pratique, derrière un proxy ou dans un conteneur,
l'en-tête `host` est celui de la machine et non le domaine public : les liens
des e-mails partiraient vers `http://localhost:3000`. **La renseigner.**

### Pour encaisser

```
STRIPE_SECRET_KEY="sk_live_…"
STRIPE_WEBHOOK_SECRET="whsec_…"
```

Voir l'étape 6 : le second ne s'obtient qu'après avoir créé le webhook.

### Pour envoyer des e-mails

```
RESEND_API_KEY="re_…"
EMAIL_FROM="L'antre du vieux geek fou <bonjour@antreduvieuxgeekfou.fr>"
```

Le domaine de `EMAIL_FROM` doit être vérifié chez Resend, sinon les messages
partent en indésirables — quand ils partent.

### Pour vendre des ouvrages numériques

```
DIGITAL_STORAGE_DIR="/var/data/numerique"
```

**Sur un volume persistant, hors du dossier servi.** Sans valeur, le
téléversement échoue avec un message clair plutôt que d'écrire quelque part au
hasard. Un dossier à l'intérieur du projet serait effacé au déploiement suivant,
avec les fichiers vendus dedans.

### Pour le ménage quotidien

```
CRON_SECRET="…"
```

À générer avec :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### Pour les photos de produits

```
NEXT_PUBLIC_IMAGE_HOSTS="images.exemple.fr,cdn.autre.com"
```

Les domaines d'où les images ont le droit de venir, séparés par des virgules.
Une photo hébergée ailleurs ne s'affichera pas — c'est volontaire : l'optimiseur
d'images va chercher l'URL depuis le serveur, et une liste ouverte en ferait un
relais de requêtes vers le réseau interne de l'hébergeur.

### Pour créer le premier compte administrateur

```
ADMIN_EMAIL="adresse-du-vendeur@…"
ADMIN_PASSWORD="un mot de passe long, choisi, et propre à ce site"
```

Voir l'étape 5. **Renseigner le mot de passe explicitement** — la raison est
expliquée là-bas, et elle a déjà coûté un compte en développement.

---

## 3. Le déploiement, dans l'ordre

```bash
npm ci                 # dépendances, à l'identique du lockfile
npm run db:deploy      # applique les migrations (JAMAIS `db:migrate` en prod)
npm run build          # construit le site
npm run start          # démarre le serveur
```

**`db:deploy` et non `db:migrate`.** Le second est interactif, compare le schéma
à la base et propose de la réinitialiser si quelque chose diverge. En
production, ça veut dire effacer les commandes. `db:deploy` applique les
migrations existantes et rien d'autre.

---

## 4. Les données de départ

```bash
npm run db:seed
```

Crée les rayons, les catégories du blog, les modes de livraison, les réglages
par défaut et le compte administrateur.

**Idempotent** : chaque enregistrement passe par sa clé naturelle, donc le
relancer ne crée pas de doublon et n'écrase pas ce qui a été modifié depuis le
back-office. On peut le rejouer sans crainte après une montée de version.

Ne jamais lancer `db:seed:demo` en production : il remplit le catalogue de faux
produits.

---

## 5. Le premier compte administrateur

C'est le seed qui le crée, à partir de `ADMIN_EMAIL` et `ADMIN_PASSWORD`. Il ne
touche pas à un compte qui existe déjà : un redéploiement distrait ne remet pas
le mot de passe à zéro.

**Si `ADMIN_PASSWORD` est vide**, le seed en tire un au hasard et l'affiche
**une seule fois** dans la console. En local on rattrape ; sur un hébergeur, la
ligne se perd dans les journaux de déploiement et le compte devient inaccessible
— c'est arrivé pendant le développement. Renseignez-le.

Ensuite, l'accès se fait à l'adresse :

```
https://<domaine>/admin
```

Aucun lien de la boutique n'y mène : c'est une adresse à mettre en favori. Sans
session, elle renvoie vers la page de connexion et y revient une fois
l'identification faite.

**Après la première connexion**, changer ce mot de passe puis vider
`ADMIN_PASSWORD` des variables d'environnement — elles restent lisibles en clair
dans le tableau de bord de l'hébergeur, et le seed ne recréera rien.

> ⚠️ **Aujourd'hui, aucun écran ne permet de changer son mot de passe depuis son
> compte.** Le seul chemin est « mot de passe oublié » sur la page de connexion,
> qui envoie un lien par e-mail — donc après avoir configuré Resend. C'est un
> manque connu, à combler avant l'ouverture.

Les accès suivants se donnent depuis le back-office (`/admin/comptes`) : la
personne crée un compte client ordinaire sur la boutique, et l'administrateur
lui attribue son rôle. `STAFF_ORDERS` voit et traite les commandes sans accéder
aux prix ni au chiffre d'affaires.

---

## 6. Le webhook Stripe

**C'est lui, et lui seul, qui marque une commande payée.** Le retour du visiteur
sur la page de confirmation ne prouve rien : cette adresse se tape à la main, et
le navigateur peut se fermer avant. Sans webhook, les paiements aboutissent chez
Stripe et les commandes restent « en attente de paiement » indéfiniment.

Dans le tableau de bord Stripe, créer un webhook vers :

```
https://<domaine>/api/webhooks/stripe
```

Événements à écouter :

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`

Stripe affiche alors une clé `whsec_…` : c'est `STRIPE_WEBHOOK_SECRET`.
**Sans elle, tous les webhooks sont refusés** — délibérément : un corps non
signé peut venir de n'importe qui, et accepter en aveugle reviendrait à laisser
un inconnu marquer des commandes payées.

Pour tester en local :

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 7. Le ménage quotidien

Purge les jetons expirés, les vieilles sessions et les paniers d'invités
abandonnés. Rien de tout cela n'est un garde-fou — ces lignes sont déjà refusées
partout — mais les tables grossissent, et on ne conserve pas indéfiniment des
données dont on n'a plus l'usage.

Sur Vercel, dans `vercel.json` :

```json
{ "crons": [{ "path": "/api/cron/menage", "schedule": "0 4 * * *" }] }
```

Sur une machine classique, une ligne de crontab :

```
0 4 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://<domaine>/api/cron/menage
```

Quatre heures du matin : la boutique dort, une suppression en masse ne croise
personne en train de commander. Si le travail ne tourne jamais, rien de grave.

---

## 8. Ouvrir la boutique

Le catalogue est visible dès le déploiement, mais **le tunnel de commande est
fermé** tant que le réglage n'est pas basculé. C'est voulu : on remplit ses
rayons avant d'ouvrir sa porte.

Dans `/admin/reglages`, cocher **« Boutique ouverte »**. Vérifier au passage :

- le seuil de livraison offerte,
- le montant minimum de commande,
- le régime de TVA — **à faire confirmer par le comptable**,
- le bandeau d'annonce affiché en haut de toutes les pages.

---

## 9. Vérifier après la mise en ligne

- [ ] Le site répond en `https`, et `http` y redirige
- [ ] Une commande de test aboutit : paiement, webhook reçu, statut « Payée »
- [ ] L'e-mail de confirmation arrive — et pas dans les indésirables
- [ ] Le back-office est accessible, et refuse un compte client ordinaire
- [ ] Un achat d'ouvrage numérique délivre bien son lien de téléchargement
- [ ] Le ménage programmé répond `200` (le tester une fois à la main)
- [ ] Les photos de produits s'affichent (sinon : `NEXT_PUBLIC_IMAGE_HOSTS`)

---

## 10. Ce qui n'est pas prêt

Autant le savoir avant d'annoncer l'ouverture.

**Les mentions légales attendent leurs coordonnées.** Les pages existent, mais
neuf champs sont à saisir dans **Administration → Réglages → Identité légale** :
raison sociale, forme juridique, SIRET, adresse, e-mail, téléphone, directeur de
la publication, hébergeur, médiateur de la consommation. Tant qu'un champ est
vide, `/legal` affiche « à compléter » à sa place, en évidence. Sans médiateur
désigné, vendre à des particuliers est une infraction (art. L616-1).

**Les CGV doivent être relues par un juriste.** Le texte en place est un point
de départ honnête, pas un document validé. Il engage le vendeur.

**Il n'y a ni page 404, ni page d'erreur, ni favicon.** Une adresse erronée
tombe sur l'écran par défaut de Next, et `public/` contient encore les icônes
de démarrage de create-next-app. Le handoff prévoit un écran « NotFound » dans
le ton de la boutique.

**Pas de `sitemap.xml` ni de `robots.txt`.** Les fonctions qui listent les
adresses publiques existent (`getAllProductSlugs`, `getAllPostSlugs`) mais rien
ne les appelle.

**PayPal est affiché mais refusé** à la validation. Soit le brancher, soit
retirer l'option de l'écran de paiement.

**Le choix du point relais n'est pas branché.** Le mode est proposé, le point
se convient ensuite par e-mail.

**Pas de changement de mot de passe depuis son compte** (voir étape 5).

**La limitation des tentatives de connexion vit en mémoire.** Elle repart à zéro
à chaque redéploiement et ne serait pas partagée entre deux instances.
Acceptable sur une seule machine à faible trafic ; `rate-limit.js` est le seul
fichier à remplacer le jour où ça change.

---

## Références

- `.env.example` — chaque variable, commentée
- `docs/AUDIT-SECURITE.md` — ce qui est protégé, ce qui est assumé
- `docs/MODELE-DONNEES.md` — le schéma et ses décisions
- `docs/CONNEXION-ET-RENDU.md` — où le code s'exécute
