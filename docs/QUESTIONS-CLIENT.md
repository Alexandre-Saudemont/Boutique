# Questions au client — réponses et écarts

> **17 août 2026.** Ce document existait en deux exemplaires : la version
> d'origine dans `docs/`, sans réponses, et la version renvoyée par le client à
> la racine du dépôt, avec ses réponses. `CLAUDE.md` pointait sur celle qui n'en
> avait aucune — d'où l'impression que rien n'avait été tranché. Les deux sont
> fusionnées ici, et le doublon a été supprimé.

Le client a répondu à **13 questions sur 14**. Le tableau ci-dessous donne sa
réponse et ce que le site fait aujourd'hui. Trois lignes ne concordent pas ;
elles sont détaillées plus bas.

## Ce qui est tranché et conforme

| # | Question | Réponse du client | État du site |
| --- | --- | --- | --- |
| 1 | Compte obligatoire pour commander ? | **Non** — commande possible avec un simple e-mail | ✅ `checkout.guestAllowed = true` |
| 2 | Neuf et occasion sur une fiche ou deux ? | **Deux fiches séparées** | ✅ `ProductCondition` porté par le produit, pas par la déclinaison |
| 3a | Seuil de livraison offerte | **50 €** | ✅ `shipping.freeAboveCents = 5000` |
| 3b | Franco calculé avant ou après réduction ? | **Après** — sur ce que le client paie réellement | ✅ commit `feat(promos)` |
| 4 | Montant minimum de commande ? | **Aucun** | ✅ `order.minimumCents = 0` |
| 6 | Avis publiés avant ou après relecture ? | **Après relecture** | ✅ `reviews.moderation = PRIOR` |
| 7 | Régime de TVA | **Franchise en base**, pas de TVA facturée | ✅ `vat.regime = FRANCHISE` |
| 8 | Gestion des box surprises | **B + C** — contenu variable, et choix d'un thème et d'une taille | ✅ note de composition en texte libre, déclinaisons par box |
| 9 | Livraison des ouvrages numériques | **A + B** — lien immédiat à durée limitée, et fichier disponible dans le compte | ✅ `DownloadGrant` expirant + espace client |
| 12 | Ichiban Kuji dès l'ouverture ? | **Non, on en reparlera** | ✅ page de présentation seule, aucune mécanique de loterie |
| 13 | Direction visuelle | *Sans réponse* | ✅ sans objet — la charte « Organic » a été livrée depuis |

---

## Les trois écarts à traiter

### 1. Un mode de livraison que le client n'a pas demandé — et des tarifs jamais validés

**Question 5.** Le client a coché **Colissimo à domicile** et **Mondial Relay**.
Il a laissé **décoché** « retrait en main propre ». Il n'a répondu à aucune des
questions de prix.

La base contient pourtant trois modes :

| Mode en base | Prix | Demandé ? |
| --- | --- | --- |
| Retrait à l'atelier | 0,00 € | **Non coché par le client** |
| Point relais Mondial Relay | 3,90 € | Oui, prix jamais validé |
| Colissimo domicile | 5,90 € | Oui, prix jamais validé |

Deux choses à faire confirmer : est-ce qu'il veut garder le retrait à l'atelier
(il a peut-être changé d'avis, ou coché trop vite), et est-ce que 3,90 € et
5,90 € lui conviennent. Ces valeurs sont des tarifs provisoires posés par défaut,
jamais approuvés. Elles sont modifiables depuis `/admin/livraison`, sans code.

**À noter aussi :** le choix du point relais sur une carte n'est pas branché. Le
client choisit « Mondial Relay » mais ne désigne aucun point. C'était annoncé
comme du travail supplémentaire dans la question elle-même.

### 2. Le profil d'accès demandé n'existe pas

**Question 10.** Réponse du client :

> D'autres personnes seront susceptibles de m'aider. Accès pour ajouter des
> produits + préparer les commandes + poster des articles dans le blog.

Les rôles disponibles aujourd'hui :

| Rôle | Ce qu'il couvre |
| --- | --- |
| `ADMIN` | tout, y compris les prix et le chiffre d'affaires |
| `STAFF_ORDERS` | commandes, expéditions, stock |
| `STAFF_SUPPORT` | commandes en lecture, avis, retours |

Aucun ne couvre **produits + commandes + blog**. Pour donner ce périmètre
aujourd'hui, il faudrait accorder `ADMIN` — ce qui ouvre aussi les prix et le
chiffre d'affaires, exactement ce que la question cherchait à éviter.

Il manque un rôle, ou l'extension de `STAFF_ORDERS` à la rédaction du catalogue
et du blog. À trancher avant qu'une seconde personne ait un accès.

### 3. Les précommandes : la demande est plus précise que ce qui est construit

**Question 11.** Réponse du client :

> Il paie tout de suite et expédition en un seul colis. Prévenir lors du panier
> que la commande ne partira qu'à la réception de la précommande, et voir si
> possibilité de proposer à ce moment-là l'expédition des produits sans
> précommande avec frais de livraison + second colis à la réception de la
> précommande avec frais de livraison.

| Ce qui est demandé | État |
| --- | --- |
| Paiement immédiat | ✅ comportement par défaut |
| Expédition en un seul colis | ✅ comportement par défaut |
| Avertissement au panier | ❌ **absent** — rien ne prévient que la commande attendra |
| Option « deux colis, deux frais de port » | ❌ **absente** |

`allowPreorder` existe sur la déclinaison et un badge s'affiche sur la fiche,
mais le panier ne dit rien. Un client peut donc commander une précommande avec
un article en stock et croire que tout part demain.

L'avertissement est une petite affaire. Le choix « deux colis » est un vrai
chantier : il faut scinder la commande, recalculer deux ports et gérer deux
expéditions. Le client lui-même a écrit « voir si possibilité » — c'est un
souhait, pas une exigence. À chiffrer à part si vous le retenez.

---

## Ce qui reste attendu du client

**Question 14 — aucune case cochée.** Rien de tout cela ne bloque le
développement, mais tout est nécessaire à l'ouverture :

- [ ] Une première liste de produits, avec photos, prix et descriptions
- [ ] Le texte de la page « À propos »
- [ ] Les conditions générales de vente — **à faire relire par un juriste**
- [ ] Les délais et conditions de retour
- [ ] Les questions et réponses de la FAQ

Voir `docs/PAGES-DE-CONTENU.md` pour le détail de ce qui est en attente sur
chaque page.
