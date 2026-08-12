import {adresseDuSite} from '@/lib/site-url';

/* `robots.txt`.

   Deux mises au point, parce que le fichier est souvent pris pour ce qu'il
   n'est pas :

   1. Ce n'est pas une protection. Un robot malveillant lit ce fichier comme une
      liste de bonnes adresses à essayer. Tout ce qui est interdit ici l'est
      **aussi** côté serveur — `/admin` exige une session au rôle suffisant,
      `/compte` et `/telechargement` vérifient à qui ils répondent. Le robots.txt
      ne fait qu'éviter que Google gaspille son passage, et surtout qu'il
      affiche dans ses résultats une page de commande ou un lien de
      téléchargement.

   2. Interdire n'est pas désindexer. Une adresse déjà connue d'un moteur peut
      rester listée sans son contenu. Pour la faire disparaître pour de bon, il
      faut un `noindex` sur la page elle-même — c'est à prévoir si l'une de ces
      adresses se retrouve un jour dans les résultats.

   `/api` est fermé aussi : les webhooks Stripe et PayPal ne répondent qu'à une
   signature valide, mais rien ne justifie qu'un moteur vienne les tâter. */

export default function robots() {
	const site = adresseDuSite();

	return {
		rules: [
			{
				userAgent: '*',
				allow: '/',
				disallow: [
					'/admin',
					'/api/',
					'/compte',
					'/panier',
					'/commande',
					'/telechargement/',
					'/newsletter/desinscription',
					/* La recherche produit une adresse différente par requête tapée :
					   indexées, ce sont des milliers de pages quasi vides qui diluent
					   le catalogue. */
					'/recherche',
				],
			},
		],
		sitemap: `${site}/sitemap.xml`,
	};
}
