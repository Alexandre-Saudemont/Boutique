# Audit de sécurité — 3 août 2026

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
