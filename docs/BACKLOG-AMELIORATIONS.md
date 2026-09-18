# Backlog — retours de l'ami après échange

Notes prises le 2026-09-18, à trier et prioriser. Rien n'est encore implémenté.

## Back-office — gestion produits

- **Colonne poids** dans la liste produits (utile pour calculer les frais de
  livraison). Voir si elle doit aussi influencer le prix affiché (ex. poids
  élevé → frais de port plus élevés affichés côté fiche produit).
- **Mise en avant manuelle** : pouvoir épingler soi-même des produits en
  "première trouvaille" depuis le back-office (plutôt qu'un tri automatique).
- **Recherche back-office** : le champ de recherche existe mais ne filtre pas
  encore par email / nom (commandes, clients ?). À rendre fonctionnel.
- **Actions groupées** : pouvoir mettre plusieurs produits en solde / en stock
  en une seule action, sans les ouvrir un par un.
- **Nombre de vues par produit** : tracker les vues pour identifier les
  produits les plus regardés (nouvelle métrique, nouveau champ ou table de
  stats).

## Back-office — commandes

- **Bandeaux de couleur** selon le statut de la commande (repérage visuel
  rapide dans la liste).
- **Blocage "livré" tant que la livraison n'est pas confirmée** : empêcher de
  passer une commande au statut "livré" si la validation du moyen de
  livraison n'a pas été faite. Voir si ça peut être automatisé (ex. dès que
  le transporteur confirme via webhook/tracking).

## Back-office — divers

- **Image du header (mascotte) programmable par date** : pouvoir changer
  l'icône du header selon une période (ex. Halloween, Noël) depuis le
  back-office plutôt qu'en dur dans le code.
- **Comptes équipe** : possibilité d'avoir plusieurs comptes admin/équipe
  (à préciser : rôles, permissions ?).

## Fiche produit

- **Date de mise en vente** : nouveau champ, utile pour les promotions.
  Ajouter un tri par date de mise en vente dans le back-office.
- **Catégorie solde / promo** : sur la fiche produit (admin), possibilité de
  marquer un produit en solde ou en promo.
- **Saisie du % de réduction** : quand un produit passe en solde/promo, on
  rentre le pourcentage manuellement. Sur la fiche produit publique, afficher
  le nouveau prix soldé + le prix d'origine barré.

## Front — header

- **Macaron "soldes"** dans le header dès qu'il y a des produits soldés.
- **Macaron "promo"** dans le header dès qu'il y a des promos en cours.
- Éventuellement un **changement de couleur** du header associé (soldes /
  promo) — détail à clarifier avec le client/design.

## Questions ouvertes à trancher avant d'implémenter

1. Solde vs promo : est-ce le même mécanisme avec juste un libellé différent,
   ou deux logiques distinctes (ex. promo = temporaire avec dates de début/fin,
   solde = déstockage) ?
2. Poids : en grammes ? Sert-il uniquement au calcul transporteur ou impacte-t-il
   aussi un prix affiché ?
3. Comptes équipe : quels rôles (lecture seule, gestion produits, gestion
   commandes) ?
4. Nombre de vues : compteur simple par produit, ou historique daté (pour un
   graphe de tendance) ?
5. Confirmation "moyen de livraison" avant "livré" : qui la déclenche
   aujourd'hui (l'admin manuellement) ? Faut-il un nouveau statut intermédiaire
   dans le tunnel de commande ?
