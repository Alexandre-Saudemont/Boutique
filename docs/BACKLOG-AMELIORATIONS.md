# Backlog — retours de l'ami après échange

Notes prises le 2026-09-18, mises à jour le 2026-10-09.

## Fait

- **Poids** par variante : colonne dans l'inventaire, et frais de livraison par
  tranche de poids (le panier calcule son poids total, les modes de livraison
  ont un poids min/max).
- **Mise en avant manuelle** des « premières trouvailles » (case sur la fiche
  produit, complétée par les nouveautés s'il n'y en a pas assez).
- **Recherche des commandes** par numéro, e-mail ou nom du destinataire.
- **Bandeaux de couleur** par statut de commande, sur les quatre écrans qui
  listent des commandes.
- **Blocage du statut « livré »** : une commande ne passe en « livré » que
  depuis « expédiée », et n'est « expédiée » que quand tous ses colis sont
  partis (existait déjà). Le numéro de suivi reste facultatif.
- **Date de mise en vente** programmable (date future = produit programmé),
  colonne et tri par date dans l'inventaire.
- **Solde** : réduction en % par variante, prix soldé + prix d'origine barré.
- **Actions groupées** dans l'inventaire : stock, mise en solde, retrait du solde.
- **Compteur de vues** par produit, tri « Les plus regardés ».
- **Macaron « Soldes »** dans le header dès qu'un produit est soldé, avec le
  filtre `/boutique?solde=1`.
- **Mascotte du header** programmable par période (écran « Mascotte »).

## En attente d'une réponse de l'ami

- **Macaron « Promo »** dans le header. Les codes promo sont saisis par les
  clients et rien n'indique qu'un code est public : il faudrait un réglage
  « code affiché publiquement » sur les codes. À confirmer que c'est voulu.
- **Changement de couleur du header** pendant les soldes/promos : pas clair
  s'il s'agit du macaron seul ou du header entier.
- **Solde et promo** : un seul mécanisme (réduction %) avec deux libellés, ou
  deux logiques distinctes (ex. promo à dates de début/fin) ?

## Reporté

- **Comptes équipe** : pas d'équipe pour le moment. Les rôles existent déjà
  (administrateur, préparation, service client) et un administrateur peut
  promouvoir un compte existant. Reste à faire si besoin : une invitation
  par e-mail (lien à usage unique) pour créer un compte équipe sans que la
  personne s'inscrive d'abord comme cliente.
- **Livraison « livré » automatique** : demanderait un branchement API chez
  chaque transporteur (Colissimo, Mondial Relay).
- **Envoi de fichiers** (images de mascotte, photos produits) : tout passe par
  une adresse https collée à la main tant qu'il n'y a pas de stockage de fichiers.
