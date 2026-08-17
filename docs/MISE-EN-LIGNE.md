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

Depuis que le site publie un `sitemap.xml`, elle n'est même plus facultative en
théorie : un plan de site n'a pas de requête d'où déduire le domaine, il ne
connaît que cette variable. Oubliée, il annonce aux moteurs de recherche une
liste d'adresses en `localhost` — c'est-à-dire rien du tout.

### Pour encaisser

```
STRIPE_SECRET_KEY="sk_live_…"
STRIPE_WEBHOOK_SECRET="whsec_…"
```

Voir l'étape 6 : le second ne s'obtient qu'après avoir créé le webhook.

**PayPal n'a pas de clés à lui.** Il est encaissé par Stripe : même compte, même
solde, même webhook. Il s'active en deux gestes, dans cet ordre — d'abord dans
le tableau de bord Stripe (*Réglages → Moyens de paiement → PayPal*), ensuite
dans **Administration → Réglages → Paiement → Proposer PayPal**. Cocher la case
du site sans avoir activé le moyen chez Stripe ferait échouer l'ouverture de la
page de paiement, juste après le clic sur « payer ».

### Pour envoyer des e-mails

```
RESEND_API_KEY="re_…"
EMAIL_FROM="L'antre du vieux geek fou <bonjour@antreduvieuxgeekfou.fr>"
```

Le domaine de `EMAIL_FROM` doit être vérifié chez Resend, sinon les messages
partent en indésirables — quand ils partent.

> **Les comptes Stripe et Resend appartiennent au client, pas au prestataire.**
> C'est une règle, pas une préférence, et elle vaut pour les deux :
>
> - **La délivrabilité se construit sur un domaine.** La réputation d'expéditeur
>   s'accumule sur `antreduvieuxgeekfou.fr`. Envoyer depuis le domaine du
>   prestataire bâtit ce capital au mauvais endroit, le perd au basculement, et
>   fait retomber les plaintes pour spam sur le domaine avec lequel il prospecte.
> - **C'est une dépendance qui lie les deux parties.** Si le compte appartient au
>   prestataire, la boutique cesse d'envoyer ses confirmations de commande le jour
>   où la collaboration s'arrête, ou simplement où une facture n'est pas payée.
> - **Ce sont les données du client.** Ses acheteurs, leurs adresses, leurs
>   paiements. Le contrat de sous-traitance doit être au nom du client.
>
> Le prestataire travaille avec un **accès collaborateur** et une **clé
> restreinte** au périmètre nécessaire — chez Stripe, une clé limitée aux
> paiements et aux webhooks, jamais la clé secrète complète. En développement,
> n'importe quel domaine vérifié fait l'affaire ; en production, non.

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

Le mot de passe se change ensuite depuis **Mon compte → Mes informations**, en
saisissant l'ancien. Ce chemin ne dépend d'aucun e-mail : il fonctionne avant
même que Resend soit configuré, ce qui en fait le bon moyen de reprendre la main
sur le compte administrateur créé au seed. « Mot de passe oublié », lui, envoie
un lien et suppose donc l'envoi d'e-mails en état de marche.

Changer son mot de passe **déconnecte les autres appareils** et garde celui d'où
part la demande. C'est ce qui rend le geste utile après un doute : sans ça, une
session ouverte ailleurs survivrait au changement.

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

## 7 bis. Sauvegardes et conservation

Deux besoins qu'il ne faut pas confondre : se remettre d'une panne, et garder
des pièces comptables dix ans. Les traiter avec le même outil donne le pire des
deux.

**Les sauvegardes** protègent de la panne. Une copie quotidienne de la base
suffit, avec une rétention courte — trente jours. Trois pièges :

- **La copie doit partir hors de la machine.** Une sauvegarde posée sur le
  disque du serveur ne sert à rien le jour où c'est le serveur qui disparaît.
- **Le dump ne contient pas les fichiers.** Les images produits et les ouvrages
  numériques (`DIGITAL_STORAGE_DIR`) vivent sur le disque. Restaurer la base
  seule rendrait des fiches sans photos et des livres achetés qu'on ne peut plus
  télécharger.
- **Une sauvegarde jamais restaurée n'est pas une sauvegarde.** Le faire une
  fois pour de vrai, sur une base jetable.

Le fichier contient les noms et adresses des acheteurs : il est chiffré au
repos, et son accès se limite à qui administre le serveur.

**La conservation légale** est un autre métier. L'obligation décennale porte sur
les pièces comptables, pas sur la base. Garder dix ans de sauvegardes
quotidiennes serait à la fois inutile et contraire au RGPD : un client qui
demande l'effacement de son compte ne peut pas l'obtenir si on conserve trois
mille copies de ses données.

Ce qui se conserve, c'est le **livre des recettes** : une ligne par
encaissement, exportée depuis `/admin/commandes` (bouton « Livre des recettes »,
réservé à l'administrateur). Un fichier par exercice, déposé là où le client
range sa comptabilité. C'est ce que demande le régime micro — date, référence,
client, montant, mode de règlement — et c'est ce qu'un contrôle réclame.

Trois précisions sur ce fichier, parce qu'elles étonnent :

- **La date retenue est celle de l'encaissement**, pas celle de la commande. Le
  régime micro est un régime de caisse : une commande passée le 31 décembre et
  payée le 2 janvier appartient à l'exercice suivant.
- **Les commandes remboursées y figurent**, avec le remboursement dans sa propre
  colonne. L'argent a bien été encaissé ; le retirer du livre ferait disparaître
  une recette réelle, ce qu'un contrôle cherche précisément.
- **Les paniers abandonnés n'y figurent pas.** Le critère est l'encaissement,
  jamais le statut.

Côté données personnelles, c'est `anonymizedAt` qui fait le travail inverse : le
compte s'efface, la commande reste avec le nom figé dessus. Les deux obligations
tiennent ensemble.

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
- [ ] **Les comptes Stripe et Resend sont au nom du client**, et `EMAIL_FROM`
      porte le domaine de la boutique — jamais celui du prestataire
- [ ] **La clé Stripe de production est une clé restreinte**, pas la clé secrète
- [ ] PayPal est activé dans le tableau de bord Stripe **en mode production**
      (le réglage est distinct de celui du mode test)
- [ ] Une commande de test aboutit : paiement, webhook reçu, statut « Payée »
- [ ] L'e-mail de confirmation arrive — et pas dans les indésirables
- [ ] Le back-office est accessible, et refuse un compte client ordinaire
- [ ] Un achat d'ouvrage numérique délivre bien son lien de téléchargement
- [ ] Le ménage programmé répond `200` (le tester une fois à la main)
- [ ] Les photos de produits s'affichent (sinon : `NEXT_PUBLIC_IMAGE_HOSTS`)
- [ ] `/sitemap.xml` liste bien le vrai domaine, et non `localhost`
- [ ] Une adresse inventée affiche le 404 de la boutique, pas l'écran de Next
- [ ] Le plan du site est déclaré dans la Search Console de Google

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

**Il manque une icône pour l'écran d'accueil des iPhone.** Le favicon existe
(`src/app/icon.svg`, la marque du handoff) et suffit à tous les navigateurs,
mais iOS ignore les icônes en SVG : ajouté aux favoris depuis un iPhone, le
site s'affiche avec une capture de la page au lieu du logo. Il faut pour cela
un PNG de 180 pixels déposé en `src/app/apple-icon.png` — une exportation à
demander au moment où le client fournira son logo définitif.

**PayPal est branché mais éteint.** Il ne s'affichera dans le tunnel qu'une fois
activé des deux côtés (voir « Pour encaisser »). Tant que la case est décochée,
l'option n'apparaît pas du tout — le site ne promet rien qu'il ne sache faire.

À savoir avant de l'activer : les litiges PayPal viennent le plus souvent
d'acheteurs estimant que **l'article ne correspond pas à sa description**. C'est
le terrain le plus exposé pour de l'occasion chinée et des box dont le contenu
n'est pas annoncé. Deux choses servent de défense, et elles existent déjà : les
photos réelles pièce par pièce, et la note de contenu saisie à la préparation
d'une box — qui devient une preuve à produire en cas de contestation.

**Le choix du point relais n'est pas branché.** Le mode est proposé, le point
se convient ensuite par e-mail.

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
