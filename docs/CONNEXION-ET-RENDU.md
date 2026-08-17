# Comment marche la connexion — et le rendu serveur de Next

Ce document explique deux choses qui se répondent : **qui est connecté**, et **où
le code s'exécute**. Les deux sont liées, parce que l'identité du visiteur ne
vit que côté serveur — c'est justement ce qui la rend sûre.

À lire dans l'ordre. La partie 1 pose le vocabulaire de Next, la partie 2
raconte la connexion, la partie 3 déroule les parcours complets.

---

## 1. Où le code s'exécute

### Le point de départ : tout est serveur par défaut

Dans l'App Router de Next, **un fichier de `src/app/` est un Server Component
tant qu'on n'écrit pas `'use client'` en première ligne**. C'est l'inverse de ce
que faisait React historiquement, et c'est le renversement qu'il faut avoir en
tête pour lire ce projet.

Un Server Component :

- s'exécute **sur le serveur uniquement** ;
- peut `await` directement une requête en base — pas de `fetch`, pas de route
  d'API, pas de `useEffect` ;
- n'est **jamais envoyé au navigateur**. Le visiteur reçoit son résultat — du
  HTML — pas son code ;
- ne peut pas avoir d'état ni d'événements : ni `useState`, ni `onClick`.

```js
// src/app/(site)/boutique/page.js — Server Component
export default async function Boutique() {
  const produits = await listProducts({});   // requête SQL, ici, directement
  return <ProductGrid produits={produits} />;
}
```

Ce que ça implique pour la sécurité, et c'est le point le plus important de ce
document : **le code d'un Server Component peut contenir des secrets**. La clé
Stripe, la requête SQL, la logique de calcul du prix : rien de tout cela ne part
dans le navigateur. Un client, lui, ne reçoit que le HTML produit.

### Les Client Components : pour ce qui bouge

`'use client'` marque la frontière. À partir de ce fichier et de tout ce qu'il
importe, le code part **aussi** dans le navigateur, où il est lisible par
n'importe qui.

On en écrit quand il faut de l'interactivité : un onglet qui bascule, une
quantité qui change, un formulaire qui affiche une erreur sans recharger.

```js
// src/components/SiteHeader/HeaderClient.js
'use client';
import {useState} from 'react';
```

La règle du projet en découle directement : **`src/server/` n'est jamais importé
par un fichier `'use client'`**. Chaque fichier de `src/server/` commence par
`import 'server-only'`, un paquet qui fait échouer le build si cette frontière
est franchie. C'est une barrière mécanique, pas une consigne à retenir.

### Les Server Actions : ce qui remplace les routes POST

Une fonction marquée `'use server'` s'exécute sur le serveur, mais peut être
appelée depuis un formulaire côté client. Next fabrique l'appel réseau, la
sérialisation et le retour.

```js
// src/app/(site)/panier/actions.js
'use server';

export async function ajouterAuPanier(precedent, donnees) {
  const jeton = await ensureCartToken();
  return addItem(jeton, donnees.get('varianteId'), donnees.get('quantite'));
}
```

**Le point de vigilance à ne jamais oublier : une Server Action est un point
d'entrée HTTP public.** Elle a une adresse, et n'importe qui peut l'appeler
directement, sans passer par la page qui l'affiche. Un bouton grisé à l'écran
ne protège rien.

C'est pour cette raison que, dans ce projet :

- chaque action du back-office rappelle `exigerDroit(...)` en première ligne,
  alors même que le layout a déjà vérifié l'accès ;
- toutes les vérifications métier (boutique ouverte, stock, appartenance d'une
  ligne de panier) vivent dans les services, pas dans l'interface.

### Ce que Next fait pour nous, et ce qu'il ne fait pas

**Il protège du CSRF** : Next vérifie l'origine des appels de Server Actions. Un
site tiers ne peut pas déclencher une action au nom d'un visiteur connecté.

**Il ne vérifie aucun droit.** L'identité, les rôles, la propriété d'une
ressource : tout cela est à notre charge, à chaque point d'entrée.

### Rendu dynamique ou statique

Une page qui lit les cookies, les en-têtes ou les paramètres d'URL devient
**dynamique** : elle est rendue à chaque requête. C'est le cas de toutes les
pages de ce site, puisqu'elles lisent la session, le panier ou les réglages en
base.

La CSP (`src/proxy.js`) rend cette propriété définitive : elle pose un
`nonce` différent à chaque réponse, ce qu'un cache statique ne peut pas servir.
C'est un choix assumé — mais c'est ce qui empêchera de rendre une future page
« À propos » statique sans y repenser.

---

## 2. La connexion

### Le principe : un jeton opaque, l'identité en base

Le cookie de session ne contient **rien d'autre qu'un nombre aléatoire de 32
octets**. Aucune information sur le compte, aucun rôle, aucune date : juste une
clé de recherche.

```
Cookie « session » : xK9mP2vN8qR5wL7tY3uZ...
                              ↓
Table sessions : token → userId, expiresAt, userAgent
                              ↓
Table users : id → email, role, …
```

**Pourquoi pas un JWT ?** Un jeton auto-porté contient lui-même l'identité,
signée. Il évite une lecture en base — et c'est son seul avantage ici. En
échange, il reste valable jusqu'à son expiration **quoi qu'on fasse** : pas de
déconnexion réelle, pas de coupure possible d'un compte compromis, pas de
« déconnecter tous mes appareils ». Pour une boutique où l'on doit pouvoir
fermer une session dans la seconde, la lecture en base — qui coûte un index —
est le bon échange.

### Les trois cookies du site

| Cookie | Contient | Durée | Rôle |
| --- | --- | --- | --- |
| `session` | jeton aléatoire | 30 jours | Identifie le compte connecté |
| `panier` | UUID | 30 jours | Relie un visiteur anonyme à son panier |
| `commande` | brouillon JSON | 4 heures | Adresse et livraison en cours de saisie |

Tous les trois sont `httpOnly` — invisibles au JavaScript de la page, donc hors
de portée d'un script injecté —, `sameSite=lax` et `secure` en production.

Le cookie `panier` est volontairement distinct de `session` : un visiteur
remplit son panier sans compte, et ces deux identités n'ont pas la même valeur.
Le jeton de panier ne donne accès qu'à un panier.

### Le cycle d'une session

**Ouverture** (`creerSession`) — un nouveau jeton est tiré, la ligne est écrite
en base, le cookie est posé. Un nouveau jeton à chaque connexion : c'est ce qui
écarte la *fixation de session*, où un attaquant fait utiliser à sa victime un
identifiant qu'il connaît déjà.

**Lecture** (`getUtilisateurCourant`) — le jeton est cherché en base, la session
expirée est supprimée au passage, un compte anonymisé est refusé. `passwordHash`
n'est jamais remonté.

**Prolongation** (`prolongerSession`) — au-delà de la moitié de sa vie, la
session est repoussée. Le seuil évite une écriture en base à chaque page vue.

**Fermeture** (`fermerSession`) — la ligne d'abord, le cookie ensuite. Dans cet
ordre : un cookie effacé sur une session encore vivante laisserait un jeton
valable dans la nature.

### Les mots de passe

`scrypt`, paramètres OWASP (N=2¹⁶, r=8, p=1), sel par mot de passe, comparaison à
temps constant. Le format stocké porte ses propres paramètres :

```
scrypt$65536$8$1$c2VsLi4u$ZW1wcmVpbnRlLi4u
```

Ce qui permet de les durcir plus tard sans invalider les comptes existants :
`needsRehash` détecte une empreinte ancienne, et la connexion suivante la remet
à niveau — le seul moment où le mot de passe en clair est disponible.

**Ce qui n'est jamais dit au visiteur** : si une adresse est connue. Le message
d'erreur est identique pour un compte inexistant et un mot de passe faux, et un
hachage leurre est calculé sur adresse inconnue pour que le temps de réponse ne
trahisse rien non plus. Sans cela, le formulaire de connexion devient un moyen
de savoir qui est client de la boutique.

### Les rôles

Quatre rôles (`CUSTOMER`, `ADMIN`, `STAFF_ORDERS`, `STAFF_SUPPORT`), mais le
code ne raisonne jamais en rôles : il raisonne en **droits nommés par ce qu'ils
permettent**.

```js
aLeDroit(utilisateur, 'commandes.gerer')   // et non : role === 'ADMIN'
```

Le tableau des correspondances vit à un seul endroit (`src/server/auth/roles.js`).
Un droit inconnu est toujours refusé : une faute de frappe ferme la porte au
lieu de l'ouvrir.

---

## 3. Les parcours, de bout en bout

### Connexion

```
1. Le visiteur poste le formulaire (Client Component)
        ↓
2. Server Action « seConnecter »
   → limitation : 10 tentatives / 15 min sur l'adresse visée
   → connecter() : vérifie le mot de passe, hachage leurre si inconnu
        ↓
3. creerSession() : jeton + ligne en base + cookie
        ↓
4. fusionnerPanier() : le panier invité rejoint le compte,
   en gardant le jeton du cookie — sans quoi le panier
   disparaîtrait juste avant le paiement
        ↓
5. redirect() vers /compte, ou vers la page demandée (?suite=)
```

Le paramètre `suite` n'accepte que des chemins internes, vérifiés **deux fois** :
à l'affichage et à la soumission. Une redirection est exactement ce qu'on ne
laisse pas choisir au navigateur — `//exemple.com` enverrait le visiteur
ailleurs juste après sa saisie de mot de passe.

### Accès à une page du back-office

```
Requête sur /admin/commandes
        ↓
proxy.js : pose la CSP et son nonce
        ↓
Layout (admin) : exigerStaff()
   → pas de session       → /compte?suite=/admin
   → session mais client  → /
        ↓
Page : exigerDroit('commandes.voir')
   → droit manquant       → /admin
        ↓
Rendu côté serveur, envoi du HTML
```

Le contrôle est **dans le layout** parce qu'un layout Next s'exécute avant chaque
page enfant : impossible d'ajouter une page dans ce dossier en oubliant de la
protéger. Il est **aussi dans chaque page et chaque action**, parce qu'une Server
Action ne passe pas par le layout.

### Mot de passe oublié

```
1. Demande → toujours la même réponse, adresse connue ou non
2. Jeton aléatoire de 32 octets, stocké HACHÉ (SHA-256)
   → le jeton en clair n'existe que dans l'e-mail reçu
   → une copie de la base ne permet pas de forger un lien
3. Validité 1 heure, usage unique, demander un nouveau lien ferme l'ancien
4. À l'usage : mot de passe changé + TOUTES les sessions fermées
   → si le compte était compromis, l'intrus est mis dehors
```

### Achat, du panier au paiement

```
Panier (cookie « panier »)
   → prix relus à chaque affichage, rien n'est figé
        ↓
Livraison → cookie « commande » (brouillon, 4 h, httpOnly)
        ↓
Paiement → creerCommande()
   → total RECALCULÉ côté serveur, jamais lu du formulaire
   → prix, noms et adresse COPIÉS dans la commande : figés à jamais
   → statut PENDING_PAYMENT, stock inchangé
        ↓
Redirection vers la page hébergée par Stripe
   → le numéro de carte ne touche jamais ce site
        ↓
Webhook signé (serveur à serveur) ← seule preuve de paiement
   → montant vérifié contre le total facturé
   → commande PAYÉE, stock décrémenté, panier vidé, e-mail envoyé
```

Le retour du visiteur sur la page de confirmation **ne déclenche rien** : cette
URL se tape à la main, et le navigateur peut se fermer avant. Seul le webhook
écrit.

---

## 4. Les huit règles à ne pas oublier

1. **Un Server Component ne part jamais au navigateur** — il peut contenir des
   secrets. Un Client Component, si : tout ce qu'il contient est public.
2. **Une Server Action est une adresse HTTP publique.** Elle revérifie les
   droits, toujours, même derrière un layout qui l'a déjà fait.
3. **Le cookie de session ne porte qu'un jeton opaque.** L'identité vit en base,
   ce qui rend la révocation immédiate possible.
4. **On ne dit jamais si une adresse est connue** — ni à la connexion, ni à
   l'inscription, ni au mot de passe oublié, ni à la newsletter.
5. **Les montants sont recalculés côté serveur** au dernier moment. Ce que le
   navigateur affiche n'engage personne.
6. **Une commande est figée à l'émission.** Adresses et lignes sont des copies,
   jamais des références.
7. **Rien n'est supprimé** : `archivedAt` pour les produits, `anonymizedAt` pour
   les comptes. L'historique de facturation doit rester intact.
8. **Tout garde-fou se double d'un test.** `npm test` — c'est ce qui empêche
   qu'une modification distraite retire un contrôle en silence.

---

## Où regarder dans le code

| Sujet | Fichier |
| --- | --- |
| Sessions | `src/server/auth/session.js` |
| Mots de passe | `src/server/auth/password.js` |
| Droits du personnel | `src/server/auth/roles.js` |
| Jetons e-mail | `src/server/auth/tokens.js` |
| Limitation de tentatives | `src/server/auth/rate-limit.js` |
| Cookie de panier | `src/server/auth/cart-session.js` |
| CSP et nonce | `src/proxy.js` |
| En-têtes de sécurité | `next.config.mjs` |
| Comptes clients | `src/server/services/accounts.js` |

Pour l'état de la sécurité et ce qui reste à faire : `docs/AUDIT-SECURITE.md`.
