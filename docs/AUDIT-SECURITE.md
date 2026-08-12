# Audit de sécurité — 3 août 2026

> **Mise à jour du même jour.** Les points 1 à 7 de la partie 3 ont tous été
> traités depuis la première rédaction : CSP, montée de Next, double opt-in,
> journal des actions, mot de passe oublié, vérification d'adresse, droit à
> l'effacement. Une suite de tests couvre désormais les garde-fous. Le détail
> est en partie 5, et les parties 1 à 4 sont laissées telles qu'elles ont été
> écrites — elles racontent l'état de départ.
>
> **12 août 2026.** `npm audit` est passé à zéro : les alertes réputées sans
> correctif sont couvertes par Next 16.3.0. Voir partie 8, qui traite aussi de
> ce que `sitemap.xml` et `robots.txt` exposent désormais.

Revue complète du code du projet : authentification, sessions, panier, tunnel de
commande, encaissement Stripe, back-office, envoi d'e-mails, configuration.

Ce document dit ce qui tient, ce que j'ai corrigé en le lisant, et ce qui reste à
faire — avec l'ordre dans lequel s'en occuper. Il est écrit pour être relu dans
six mois : chaque point explique le risque, pas seulement le remède.

**État général : sain.** Rien qui expose des données clients ou permette de
payer moins que le prix. Les manques listés en partie 3 sont réels, mais aucun
n'est un trou ouvert aujourd'hui.

---

## 1. Ce qui est solide

**Mots de passe.** scrypt aux paramètres OWASP (N=2¹⁶), sel par mot de passe,
comparaison à temps constant, remise à niveau automatique des vieilles empreintes
à la connexion. Le mot de passe n'est jamais journalisé et `passwordHash` n'est
remonté par aucune lecture.

**Sessions.** Jeton aléatoire de 32 octets, identité en base, cookie `httpOnly` +
`sameSite=lax` + `secure` en production. Révocables immédiatement, ce qu'un JWT
ne permet pas. Un nouveau jeton est tiré à chaque connexion — pas de fixation de
session possible.

**Énumération de comptes.** Le formulaire de connexion renvoie le même message
dans tous les cas, et un hachage leurre est calculé sur adresse inconnue pour que
le temps de réponse ne trahisse rien. L'inscription sur une adresse déjà prise
répond « ok » sans rien créer. La newsletter suit la même règle.

**Force brute.** Limitée sur la connexion (10 essais / 15 min par adresse visée)
et sur l'inscription. Fenêtre glissante, pas de compteur remis à zéro exploitable
à cheval sur deux périodes.

**Paiement.** Le numéro de carte ne touche jamais le site — page hébergée par
Stripe. Seul le webhook signé marque une commande payée ; le retour du visiteur
sur la page de confirmation ne prouve rien et ne déclenche aucune écriture. La
signature est vérifiée sur le corps brut, et l'absence de `STRIPE_WEBHOOK_SECRET`
fait refuser tous les webhooks plutôt que de les accepter en aveugle. Le montant
encaissé est comparé au total facturé ; en cas d'écart, la commande reste en
attente avec une note plutôt que de partir en préparation.

**Montants.** Recalculés côté serveur au dernier moment, jamais lus depuis le
formulaire. Un panier trafiqué dans le navigateur n'a aucun effet sur le prix
débité.

**Isolation des données.** Toutes les lectures de panier passent par le jeton du
cookie (`cart: {sessionToken}` dans la clause), donc deviner un identifiant de
ligne ne donne accès à rien. Une commande consultée par un invité exige numéro
**et** e-mail.

**Back-office.** Contrôle d'accès dans le layout du groupe `(admin)` — impossible
d'y ajouter une page non protégée — **et** dans chaque action serveur et
gestionnaire de route, parce qu'une action est un point d'entrée HTTP appelable
sans passer par sa page. Les droits sont nommés par ce qu'ils permettent, pas par
les rôles qui les portent.

**Injection.** Prisma partout, aucun `$queryRaw`. Aucun `dangerouslySetInnerHTML`
dans le projet. Le contenu du blog est stocké et rendu comme du texte. Les
e-mails échappent tout ce qui vient d'une saisie.

**Export CSV.** Les cellules commençant par `=`, `+`, `-` ou `@` sont
neutralisées : une adresse e-mail forgée à l'inscription ne devient pas une
formule exécutée à l'ouverture du fichier dans un tableur.

**Secrets.** `.env` ignoré par git et absent du dépôt. Aucune clé en dur dans le
code.

---

## 2. Corrigé pendant l'audit

| Trouvé | Risque | Correctif |
| --- | --- | --- |
| Le panier disparaissait après connexion : la fusion effaçait le `sessionToken` alors que tout le site retrouve le panier par ce jeton | Perte de commande au pire moment. Pas une faille, mais le défaut le plus coûteux du lot | Le jeton suit désormais le panier conservé |
| `next/image` sans domaines déclarés, alors que le back-office accepte des URL d'images arbitraires | Photos jamais affichées ; et tout ouvrir aurait fait de l'optimiseur un relais de requêtes vers le réseau interne de l'hébergeur (SSRF) | Liste de domaines par variable d'environnement, et validation à la saisie : `https` seul, adresses internes refusées |
| Formulaire newsletter sans limite | Remplissage de la liste par un robot ; inscription forcée de l'adresse d'un tiers en boucle | 5 inscriptions par heure et par adresse, réponse identique au succès |
| Création de commande sans limite | Table de commandes fantômes, quota d'API Stripe consommé | 10 tentatives par 10 minutes et par panier |
| En-tête `X-Powered-By` | Annonce la technologie et sa version, première information cherchée par un scan | `poweredByHeader: false` |

---

## 3. Ce qui reste à faire

### Avant la mise en ligne

**1. Content-Security-Policy — le manque le plus important.**
Aucune CSP n'est posée aujourd'hui. C'est le filet qui limite les dégâts si une
injection passe malgré tout : sans elle, un script injecté s'exécute sans
entrave. Elle demande un `nonce` par requête, donc un middleware Next, et doit
être testée écran par écran — une CSP posée à la va-vite casse les scripts de
Next en silence, et une CSP qui autorise `unsafe-inline` ne protège de rien.
Compter une demi-journée, à faire juste avant l'ouverture.

**2. Monter Next en 16.2.x.**
`npm audit` remonte 3 vulnérabilités *high* héritées de `sharp` et `postcss`
(traitement d'images côté serveur). Sans rapport avec le code du projet, corrigées
en amont. À faire avec une passe de tests d'affichage.

**3. Double opt-in de la newsletter.**
Le champ `confirmedAt` existe mais n'est jamais renseigné : une adresse est
inscrite sans confirmation. N'importe qui peut donc inscrire l'adresse d'un
tiers, et le RGPD demande une preuve de consentement que nous n'aurions pas.
Maintenant que l'envoi d'e-mails existe, c'est une heure de travail.

### Dans les semaines qui suivent

**4. Journal des actions du personnel.**
Le modèle `AuditLog` est prévu mais rien ne l'alimente. Dès qu'une seconde
personne aura un accès, il faudra savoir qui a changé un prix ou annulé une
commande — c'est aussi ce qui protège une personne accusée à tort.

**5. Mot de passe oublié.**
Aucun parcours de réinitialisation : un client qui oublie son mot de passe n'a
aucun recours automatique. Ce n'est pas une faille, c'est un manque, et il
poussera à des contournements manuels risqués (« je te remets ton mot de passe à
la main ») si personne ne le traite.

**6. Vérification de l'adresse e-mail à l'inscription.**
Rien ne prouve aujourd'hui que le compte créé appartient bien au titulaire de
l'adresse.

**7. Droit à l'effacement.**
`anonymizedAt` est prévu et respecté à la connexion, mais aucun écran ne permet
de déclencher l'anonymisation. Obligation RGPD à traiter avant d'avoir beaucoup
de clients.

### Limites connues et assumées

**Compteur de tentatives en mémoire.** Il repart à zéro au redéploiement et ne
serait pas partagé entre deux instances. Acceptable pour une boutique à faible
trafic sur une seule machine ; `rate-limit.js` est le seul fichier à remplacer
(par Redis ou une table) le jour où ça change.

**Blocage ciblé d'un compte.** Puisque la limite porte sur l'adresse visée,
quelqu'un peut volontairement bloquer la connexion d'un client pendant quinze
minutes. C'est le compromis inverse — limiter par IP laisserait passer une
attaque distribuée. Pour une boutique de cette taille, le bon choix.

**Survente possible.** Deux clients peuvent payer la dernière pièce à quelques
secondes d'intervalle ; le stock passe alors sous zéro, visible en
administration. Choix délibéré : réserver le stock dès la mise au panier
bloquerait des pièces pour des paniers abandonnés.

**Cookie de brouillon de commande.** Il contient nom et adresse en clair,
`httpOnly`, quatre heures. Pas de chiffrement — ce sont des données que le
visiteur vient de saisir lui-même, sur sa propre machine.

**Aucun test automatisé.** Rien ne verrouille les garde-fous décrits ici : une
modification distraite peut retirer un contrôle sans que rien ne proteste. C'est
le plus gros risque à moyen terme du projet, et il grandit à chaque écran ajouté.

---

## 4. Ce que je n'ai pas pu vérifier

- **L'encaissement réel.** Aucune clé Stripe n'est disponible : le tunnel n'a
  jamais été exécuté de bout en bout contre l'API. À reprendre en mode test dès
  que le compte existe, webhook compris (`stripe listen`).
- **L'envoi d'e-mails.** Même chose : sans clé Resend, les messages sont écrits
  dans la console. Le contenu a été relu, pas la délivrabilité.
- **Le comportement en production** (proxy, en-têtes transmis, HSTS effectif) :
  rien n'est déployé à ce jour.

---

## 5. Suites données — même jour

### Traité

**Content-Security-Policy** (`src/proxy.js`). Un `nonce` par réponse, seul
moyen d'autoriser les scripts d'hydratation de Next sans ouvrir la porte à ceux
qu'on injecterait. Vérifié sur cinq pages : aucune balise `<script>` sans nonce.
`strict-dynamic` évite d'énumérer des domaines qui changeront. Les styles
restent en `unsafe-inline` — React pose des styles en ligne que le projet
utilise ; le risque est un défacement, pas une exécution.
*Conséquence :* aucune page portant cette CSP ne peut être servie depuis un
cache statique. Toutes sont déjà dynamiques, le coût est nul aujourd'hui.

**Next 16.2.12.** Les trois alertes `npm audit` **subsistent** et c'est
volontaire : elles viennent de `postcss` et `sharp`, dépendances internes de
Next qu'aucune version publiée ne corrige — le seul « correctif » proposé est un
retour à Next 9. Le risque réel est faible : `postcss` traite au build du CSS
que nous écrivons, `sharp` traite des images dont les domaines sont désormais
restreints. À revoir à chaque montée de version.

> *Réglé le 12 août 2026 : Next 16.3.0 embarque les versions corrigées. Voir
> partie 8.*

**Double opt-in de la lettre.** Une adresse ne reçoit rien tant que le lien
envoyé n'a pas été suivi. Une adresse déjà confirmée ne reçoit pas de second
message — ce serait le moyen le plus simple de la harceler depuis le formulaire
public. Le lien porte un jeton opaque, jamais l'adresse. Désinscription en un
clic, sans question posée.

**Journal des actions du personnel.** `AuditLog` est alimenté par chaque
écriture du back-office ; l'historique s'affiche sur la fiche commande. Aucune
donnée personnelle n'y entre (ni le texte d'une note, ni une adresse) : le
journal se conserve bien plus longtemps que ces données ne le justifient. Et
journaliser n'échoue jamais bruyamment — perdre une ligne de journal ne doit pas
défaire le travail de quelqu'un.

**Mot de passe oublié et vérification d'adresse.** Jetons à usage unique,
**stockés hachés** : le jeton en clair ne vit que dans l'e-mail du destinataire,
une copie de la base ne permet pas de forger un lien. Une heure de validité pour
un mot de passe, un jour pour une adresse ; demander un nouveau lien ferme le
précédent. Réinitialiser **ferme toutes les sessions** — sans quoi l'opération
serait inutile face à une intrusion. Le formulaire de demande répond la même
phrase pour une adresse connue, inconnue ou limitée.

**Droit à l'effacement.** Le compte est anonymisé, pas supprimé : les commandes
sont des pièces comptables à conserver dix ans. Disparaissent l'adresse, le nom,
le téléphone, le mot de passe, les sessions, les jetons, le panier, les adresses
enregistrées et le nom affiché sous les avis. Le mot de passe est redemandé —
une session ouverte sur un poste partagé ne doit pas suffire.

**Tests.** 288 tests (`npm test`). Les unitaires couvrent scrypt et ses
paramètres, la matrice des droits, la limitation glissante, la validation, la
conversion des prix, la neutralisation des formules CSV, le refus des clés de
réglage inventées, chaque directive de la CSP. Les tests d'intégration, contre
un vrai PostgreSQL, vérifient qu'un panier n'est ni lisible ni modifiable avec
le jeton d'un autre, que les montants sont recalculés côté serveur, qu'une
commande est figée, que les transitions de statut sont fermées, et que chaque
manière connue de détourner un jeton échoue.

### Ajouté depuis, à traiter

**`connect-src 'self'`** interdit tout appel sortant. C'est volontaire
aujourd'hui, puisque le paiement se fait sur une page hébergée par Stripe. Le
jour où un paiement intégré arriverait, cette directive devra s'ouvrir aux
domaines de Stripe — et à eux seuls.

**Limitation toujours en mémoire.** Inchangé : mono-instance. Voir plus haut.

---

## 6. Suites données — 4 août 2026

**CSP vérifiée au navigateur.** Passe faite sur le build de production, dans
Chrome : accueil, boutique, fiche produit, panier, étape livraison, espace
client. Les menus déroulants s'ouvrent, l'ajout au panier passe (donc les
Server Actions et l'hydratation fonctionnent sous la politique), le champ de
code promo s'ouvre, les modes de livraison se sélectionnent. **Aucun message
dans la console.** L'en-tête est présent sur chaque réponse, y compris les 404
et les redirections, et les 140 balises `<script>` servies sur ces écrans
portent toutes un nonce.

*Ce que cette passe ne prouve pas :* on ne peut pas fabriquer une violation
depuis l'extension pour vérifier que le navigateur la refuserait — un script
injecté par une extension s'exécute dans un monde isolé, hors de portée de la
CSP de la page. La preuve que la politique bloque reste celle des tests
unitaires sur les directives ; ce qui est démontré ici, c'est qu'elle ne casse
rien.

**Ménage programmé** (`/api/cron/menage`, `services/maintenance.js`). Jetons,
sessions expirées et paniers d'invités abandonnés sont purgés par un appel
quotidien de l'ordonnanceur. Rien ici n'est un garde-fou — ces lignes sont déjà
refusées partout — le motif est de ne pas conserver indéfiniment des données
dont on n'a plus l'usage, ce que le RGPD demande.

Le panier d'un **compte** n'est jamais touché, quel que soit son âge : son
propriétaire le retrouve en se connectant. Un test le verrouille, parce que le
défaut le plus coûteux trouvé pendant l'audit était déjà un panier effacé au
mauvais moment.

La route est fermée par un secret (`CRON_SECRET`) comparé à temps constant, et
**refuse tout si le secret n'est pas configuré** — un oubli de variable
d'environnement ne doit pas laisser une route d'écriture ouverte alors que le
site continue de marcher. Elle répond 404, pas 401 : à un appelant non
autorisé, elle n'a pas à confirmer qu'elle existe.

---

## 7. Audit des ouvrages numériques — 4 août 2026

Revue de la surface ajoutée par la vente de fichiers : stockage, délivrance des
droits, deux chemins de téléchargement, téléversement en back-office.

### Ce qui tient

**Le fichier n'est jamais joignable.** Il vit hors du dossier servi, sous un nom
de seize octets aléatoires et sans extension. La seule fonction qui transforme
une clé en chemin disque vérifie que le résultat reste dans le dossier — une clé
contenant `..` échoue, même si l'on ne voit pas comment elle y arriverait.

**Le jeton du lien est stocké haché** (SHA-256), comme ceux des e-mails. Une
copie de la base ne permet pas de rejouer les téléchargements de tous les
clients. Il ne vit en clair que dans le message envoyé.

**La page d'atterrissage ne consomme rien.** Les clients de messagerie et les
antivirus d'entreprise préchargent les liens : si l'ouverture de l'URL décomptait
un téléchargement, un client perdrait ses cinq essais sans avoir cliqué. Seul le
bouton, en POST, consomme — et le compteur avance dans la clause `where`, donc
deux requêtes simultanées sur le dernier téléchargement ne passent pas toutes les
deux.

**Un site tiers ne peut pas déclencher un téléchargement** depuis le navigateur
d'un visiteur : les deux routes refusent une requête `Sec-Fetch-Site:
cross-site`. Il ne pourrait rien lire de la réponse, mais il pourrait brûler les
cinq essais d'un lien.

**Un fichier déjà vendu ne peut plus être retiré du catalogue.** C'est ce qui
tient la promesse d'accès à vie : sans ce refus, un clic en back-office
couperait l'accès de tous ceux qui ont payé, sans que rien ne le signale.

### Trois défauts trouvés et corrigés

**1. Un compte non vérifié récupérait les achats d'un homonyme d'adresse.**
Les fichiers achetés en invité se rattachent au compte créé ensuite sur la même
adresse — un vrai besoin, on ne veut pas répondre « écrivez-moi ». Mais rien ne
prouve à l'inscription que l'adresse saisie vous appartient : il suffisait donc
de créer un compte sur l'adresse d'un client pour récupérer ses ouvrages.
Le rattachement par adresse exige désormais `emailVerifiedAt`. Le rattachement
par compte, lui, n'a rien à prouver.

**2. Les commandes n'étaient rattachées à aucun compte.** `creerCommande`
n'écrivait jamais `userId`, y compris pour un client connecté. Défaut
antérieur à ce chantier, révélé par lui : l'espace client ne retrouvait ses
commandes que par l'adresse, et l'accès « à vie » reposait entièrement sur la
vérification d'adresse. Corrigé — l'action lit la session et passe le compte au
service.

**3. Le droit à l'effacement laissait des adresses e-mail derrière lui.**
`DownloadGrant` porte l'adresse de la commande en clair. Après anonymisation,
elle survivait en base et les liens envoyés continuaient de fonctionner pour un
compte qui n'existait plus. Les droits sont maintenant supprimés à
l'anonymisation, par compte **et** par adresse. Ils ne sont pas des pièces
comptables — ce sont des accès, comme une session. La commande, elle, reste.

### Durci par précaution

**Le type de contenu est filtré à la sortie.** Le type MIME stocké vient d'une
déclaration du navigateur au téléversement, jamais vérifiée. Tout ce qui n'est
pas dans la liste blanche est servi en `application/octet-stream`. Un fichier
enregistré comme `text/html` et servi depuis notre domaine serait le point de
départ d'une injection de script ; `Content-Disposition: attachment` et
`nosniff` l'empêchent déjà, mais rien n'oblige à s'en remettre au navigateur.

**Le nom de fichier est encodé selon la RFC 5987** dans l'en-tête. Vérifié avec
un nom contenant guillemets et espaces : il ressort échappé, aucune injection
d'en-tête n'est possible.

### Limites assumées

**Le jeton voyage dans l'URL.** Il apparaît donc dans les journaux du serveur et
l'historique du navigateur. C'est inhérent à un lien de téléchargement envoyé
par e-mail ; `Referrer-Policy: strict-origin-when-cross-origin` empêche au moins
qu'il parte chez un tiers. Sa portée est limitée à un fichier, trente jours et
cinq usages.

**Le contenu du fichier n'est pas analysé.** Seul un compte du personnel
téléverse, et le fichier n'est jamais exécuté ni interprété — il n'y a pas
d'antivirus dans la boucle, et il n'y en aura pas.

**Les droits ne sont pas purgés par le ménage programmé**, volontairement : leur
date d'expiration ne borne que le lien e-mail, la ligne porte l'accès à vie.
C'est écrit dans `maintenance.js`, pour qu'on ne l'ajoute pas par distraction.

### Hors sécurité, relevé au passage

~~Onze liens de la page d'accueil et du pied de page mènent à des pages qui
n'existent pas encore : `/a-propos`, `/blog`, `/box`, `/contact`,
`/ichiban-kuji`, `/recherche` et les quatre ancres de `/legal`.~~ **Corrigé.**
Les sept pages sont construites, et les quarante liens internes du site
répondent. Voir `docs/PAGES-DE-CONTENU.md` pour ce que chacune fait et ce qui
reste à remplir par le client.

Un ouvrage numérique était en rupture de stock dès sa mise en vente, donc
impossible à mettre au panier : le stock d'un fichier vaut zéro et n'a aucune
raison de bouger. Corrigé avec le chantier.

~~Next annonce au build que la convention `middleware` est dépréciée au profit de
`proxy`.~~ **Fait.** `src/middleware.js` est devenu `src/proxy.js`, exportant
`proxy()` au lieu de `middleware()` — le mécanisme est identique, `config.matcher`
compris. Les en-têtes ont été revérifiés sur une vraie réponse de production
après migration, et un test échoue désormais si `src/middleware.js` réapparaît :
Next reconnaît encore les deux fichiers mais n'en exécute qu'un, et le site
tournerait sans CSP sans que rien ne le signale.

Les conditions générales de vente devront mentionner l'absence de droit de
rétractation sur les fichiers téléchargés (art. L221-28 du code de la
consommation). La fiche produit le dit déjà, le document contractuel doit le
dire aussi. C'est un point à signaler au juriste qui relira les CGV.

---

## 8. Dépendances et surface publique — 12 août 2026

### `npm audit` est à zéro

Les six alertes *high* qui subsistaient sont éteintes. Aucune ne venait du code
du projet, et aucune ne demandait de contournement :

**`sharp` et `postcss`** arrivaient par Next. Elles étaient réputées sans
correctif publié — c'était vrai à la rédaction de la partie 5, ça ne l'est plus.
**Next 16.3.0** embarque `sharp` 0.35.3 (libvips 8.18.3, où les quatre CVE de
`libvips` sont corrigées) et `postcss` 8.5.23. Montée de 16.2.12 à 16.3.0 : build
vert, 319 tests verts, passe d'affichage faite au navigateur sur les treize pages
publiques, aucune erreur en console.

Ce que cette passe n'a **pas** pu vérifier : l'optimiseur d'images de bout en
bout. Aucun produit du jeu de données ne porte encore de photo — les fiches
affichent leur initiale. `sharp` a donc été exercé directement (encodage WebP,
relecture des dimensions : correct), mais le chemin `next/image` complet reste à
revoir le jour où le client fournira ses premières photos.

**`brace-expansion`, `fast-uri`, `js-yaml`** venaient de l'outillage ESLint. Elles
ne partent jamais en production : ce sont des dépendances de développement. Elles
comptaient tout de même, parce qu'un `npm audit` qui affiche en permanence six
lignes rouges est un `npm audit` que plus personne ne lit — et c'est comme ça
qu'une vraie alerte passe inaperçue. Corrigées par `npm audit fix`, sans
changement de version majeure.

### La CSP autorisait `eval()` en développement… en l'interdisant

À l'inverse : `script-src` n'accordait pas `'unsafe-eval'`, or React s'en sert en
mode développement pour reconstruire les piles d'appel. Chaque page affichait donc
une erreur en console, et les traces devenaient inexploitables en local. Une CSP
qui gêne le travail quotidien finit desserrée en bloc, sans discernement — mieux
vaut ouvrir précisément ce qui doit l'être. `'unsafe-eval'` est désormais accordé
**hors production seulement**, et un test échoue si la production le voit un jour :
avec lui, un script injecté fabrique du code à la volée et le nonce ne protège
plus de grand-chose.

### Ce que le site expose désormais aux moteurs

`sitemap.xml` et `robots.txt` sont posés. Ils ne sont pas des mesures de sécurité
et ne doivent pas être lus comme telles — tout ce qu'ils désignent est fermé côté
serveur, et testé. Mais ils décident de ce qui se retrouve dans les résultats de
recherche, et à ce titre ils appartiennent à cette revue.

Le sitemap n'énumère que des pages publiques : ni panier, ni tunnel de commande,
ni espace compte, ni lien de téléchargement. Le premier filtre est de ne pas
lister. `robots.txt` les interdit en plus, ceinture et bretelles, et un test
unitaire échoue si `/telechargement/` sort de la liste — un jeton de
téléchargement indexé, c'est l'ouvrage numérique d'un client servi à qui passe
par là.

Deux limites à garder en tête. D'abord, `robots.txt` est une liste publique de
bonnes adresses à essayer : un robot malveillant la lit dans ce sens. Ensuite,
interdire n'est pas désindexer — une adresse déjà connue d'un moteur peut rester
listée sans son contenu. Pour la faire disparaître, il faut un `noindex` sur la
page elle-même. Les pages qui en portent déjà un (confirmation de newsletter,
par exemple) sont les bonnes candidates si le cas se présente.

L'écran d'erreur, lui, affiche le `digest` de l'incident et **jamais**
`error.message` : le message d'une exception serveur cite volontiers un nom de
table, une requête, parfois une chaîne de connexion. Le visiteur n'en ferait
rien, un curieux si.
