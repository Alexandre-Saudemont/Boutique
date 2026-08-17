# Les pages de contenu

Les sept écrans qui manquaient à l'ouverture, et qui rendaient onze liens du
site cliquables vers une page d'erreur. Ce document dit ce que chacun fait, ce
qui a été décidé au passage, et ce qui reste à remplir avant la mise en ligne.

## Ce qui a été construit

| Page                | Source des données                            |
| ------------------- | --------------------------------------------- |
| `/legal`            | Réglages (identité légale), tarifs, TVA        |
| `/a-propos`         | Texte fixe                                     |
| `/contact` + `#faq` | Réglages, modes de livraison réels             |
| `/recherche`        | Catalogue et articles                          |
| `/blog`, `/blog/[slug]` | Articles du back-office                    |
| `/box`              | Rayon `box-surprise` et ses variantes de taille |
| `/ichiban-kuji`     | Texte fixe                                     |

## Trois décisions qui méritent une explication

### Les mentions légales affichent leurs trous

Une page légale a besoin d'un SIRET, d'une adresse, d'un hébergeur, d'un
médiateur. Rien de tout ça n'était en base, et rien de tout ça ne s'invente : une
mention légale fausse est une fausse déclaration, pas un texte d'attente.

Ces coordonnées sont donc devenues des réglages, modifiables depuis
**Administration → Réglages → Identité légale**, sans redéploiement. Tant qu'une
case est vide, la page affiche un marqueur voyant « à compléter » à sa place.
C'est volontairement laid : un trou qu'on voit se remplit, un texte plausible
qui traîne ne se relit jamais.

**À faire avant l'ouverture :** remplir les neuf champs, et faire relire les CGV
par un juriste.

### Le bandeau cookies informe, il ne demande rien

Le site pose quatre cookies — `session`, `panier`, `commande`, `promo` — tous
strictement nécessaires à son fonctionnement, aucun traceur, aucun tiers. Cette
catégorie est dispensée de consentement.

Le bandeau (`src/components/CookieBanner/`) le dit et propose **un seul
bouton**, « J'ai compris ». La maquette en prévoyait trois — Tout accepter,
Refuser, Personnaliser — qui n'auraient commandé rien du tout. Un « Refuser »
qui ne refuse rien est un faux : le visiteur croit avoir arbitré, et la boutique
affiche une conformité qu'elle n'a pas eu à obtenir.

Le choix est retenu dans `localStorage`, pas dans un cookie : en ajouter un
cinquième pour annoncer qu'on en pose quatre serait un comble, et la liste
publiée sur `/legal#cookies` reste exacte toute seule.

**Ce qui ferait tomber cette dispense :** ajouter une mesure d'audience, un
pixel publicitaire ou une vidéo embarquée. Il ne suffira alors **pas** de
rajouter des boutons à ce bandeau : il faudra un refus qui bloque le dépôt
*avant* qu'il ait lieu, et un moyen de revenir sur son choix. C'est un mécanisme
à construire, pas un libellé à changer.

### La page des box n'est pas le configurateur de la maquette

La maquette montrait un configurateur : thème, taille, préférences cochables, un
mot libre pour le vieux geek, et un récapitulatif qui se met à jour.

Rien en base ne saurait porter ces préférences jusqu'à la commande. Il faudrait
un champ sur la ligne de commande, son affichage dans l'écran de préparation, et
un test garantissant que la note du client ne se perd pas entre le panier et
l'atelier. C'est un chantier, pas une page.

Ce qui est en ligne se tient debout seul : les box du rayon, filtrables par
taille, achetables par le tunnel existant. Choisir « M » ne montre que les box
qui existent en M, **au prix du M** — pas au prix d'appel du S. Le configurateur,
si le client le veut, viendra se poser dessus sans rien casser.

De même, `/ichiban-kuji` est une page d'annonce et non une loterie : le tirage
de démonstration de la maquette n'a pas été repris. Un tirage simulé sur la page
d'une loterie payante se retient comme une promesse.

## Deux menus qui mentaient

Le menu « Box surprise » de l'en-tête proposait quatre thèmes (Manga,
Rétro-gaming, Horreur, Mystère total) et trois tailles écrits en dur dans le
composant. Trois de ces thèmes n'existent pas au catalogue : on cliquait, on
tombait sur une page vide.

Thèmes et tailles viennent maintenant de la base. Une taille n'apparaît que si
une box la porte vraiment, et son prix est le plus bas réellement pratiqué. Même
principe pour les suggestions de la page de recherche, qui listent les rayons
réels.

## Le formulaire de contact

Trois garde-fous, chacun doublé d'un test (`tests/unite/contact.test.js`) :

- un **champ-piège** invisible, qui renvoie un faux succès aux robots — leur
  dire qu'ils ont été repérés reviendrait à leur expliquer comment passer ;
- la **liste des sujets vérifiée côté serveur**, parce qu'un `<select>` se
  réécrit dans le navigateur et déciderait sinon de la ligne d'objet des e-mails
  reçus par le client ;
- une **limite de trois messages par quart d'heure** et par adresse.

**Limite assumée :** le message part par e-mail et n'est stocké nulle part. Si
l'envoi échoue, le visiteur en est averti immédiatement plutôt que rassuré à
tort. Le jour où le volume le justifiera, une boîte de réception dans le
back-office sera le bon ajout.

Le message arrive à l'adresse publiée dans les mentions légales
(`legal.email`) ; à défaut, à l'adresse d'expédition du site.

## Ce qui reste à faire

- Remplir les neuf champs d'identité légale et faire relire les CGV.
- Remplacer le texte de `/a-propos` par le vrai récit du client
  (voir `QUESTIONS-CLIENT.md`, point 14).
- Fournir les photos : portrait de la page « à propos », couvertures
  d'articles. Les emplacements affichent une initiale en attendant.
- Trancher le point 12 (Ichiban Kuji) et le configurateur de box, si le client
  les veut vraiment.
