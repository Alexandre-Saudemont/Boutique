import {NextResponse} from 'next/server';

/* Content-Security-Policy.

   C'est le filet qui limite les dégâts si une injection passe malgré tout :
   sans elle, un script glissé dans une page s'exécute sans entrave, lit ce que
   le visiteur tape et parle à qui il veut. Les autres en-têtes de sécurité sont
   posés dans `next.config.mjs` — celui-ci a besoin d'un middleware parce qu'il
   change à chaque requête.

   **Pourquoi un nonce.** Next pose des scripts en ligne pour l'hydratation :
   les autoriser en bloc (`unsafe-inline`) rendrait la CSP inutile, puisque
   c'est précisément ce qu'un attaquant injecte. On tire donc un jeton aléatoire
   par requête, on le transmet à Next par un en-tête, et seuls les scripts qui
   le portent s'exécutent. Un script injecté ne peut pas le deviner : il change
   à chaque chargement.

   **Conséquence à connaître :** un nonce doit être unique par réponse, donc
   aucune page portant cette CSP ne peut être servie depuis un cache statique.
   Toutes les pages du site sont déjà rendues à la demande (session, panier,
   réglages en base), le coût est donc nul aujourd'hui — mais c'est ce qui
   empêchera de rendre statique une page « À propos » sans y repenser.

   **`strict-dynamic`** laisse un script déjà autorisé en charger d'autres.
   C'est ce dont Next a besoin pour aller chercher ses fragments de code, et ça
   évite d'énumérer des domaines qui changeront. */

/* La politique, séparée du middleware pour être testable telle quelle.

   Un test peut ainsi vérifier chaque directive sans avoir à simuler une requête
   ni à inspecter le format interne des réponses de Next — qui, lui, changera. */
export function construirePolitique(nonce) {
	const directives = [
		"default-src 'self'",

		/* `strict-dynamic` fait ignorer `'self'` par les navigateurs modernes ;
		   il reste là pour les anciens, qui ignorent `strict-dynamic`.
		   `unsafe-inline` est présent pour la même raison et sera de même ignoré
		   dès qu'un nonce est reconnu — ce n'est pas un relâchement. */
		`script-src 'nonce-${nonce}' 'strict-dynamic' 'self' 'unsafe-inline' https:`,

		/* Les styles restent en `unsafe-inline`, faute de mieux : les CSS Modules
		   sont servis en fichiers, mais React pose des styles en ligne
		   (`style={{…}}`) que le projet utilise à plusieurs endroits. Le risque
		   est bien moindre qu'avec les scripts — au pire, un défacement. À
		   resserrer le jour où plus aucun `style` en ligne ne subsiste. */
		"style-src 'self' 'unsafe-inline'",

		// Les images de produits peuvent venir d'un hébergeur tiers en https.
		"img-src 'self' data: blob: https:",
		"font-src 'self' data:",

		/* Ce que la page a le droit d'appeler. Stripe s'ajoutera ici le jour où
		   un paiement intégré remplacera la page hébergée — aujourd'hui, le
		   visiteur quitte le site pour payer, il n'y a donc rien à autoriser. */
		"connect-src 'self'",

		// Aucun formulaire ne doit poster ailleurs que chez nous.
		"form-action 'self'",

		// Doublon volontaire de X-Frame-Options : la directive moderne, comprise
		// des navigateurs récents, l'en-tête pour les autres.
		"frame-ancestors 'none'",

		"base-uri 'self'",
		"object-src 'none'",

		/* Ne s'applique qu'en production : en développement, tout est en clair
		   sur localhost et cette directive casserait le rechargement à chaud. */
		...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
	];

	return directives.join('; ');
}

export function middleware(requete) {
	/* Un nonce par réponse, imprévisible : c'est ce qui distingue les scripts de
	   Next de ceux qu'un attaquant injecterait. */
	const nonce = crypto.randomUUID().replaceAll('-', '');
	const politique = construirePolitique(nonce);

	/* Le nonce voyage vers le rendu par un en-tête de requête : c'est là que Next
	   va le chercher pour l'apposer sur ses propres balises `<script>`. */
	const enTetes = new Headers(requete.headers);
	enTetes.set('x-nonce', nonce);
	enTetes.set('Content-Security-Policy', politique);

	const reponse = NextResponse.next({request: {headers: enTetes}});
	reponse.headers.set('Content-Security-Policy', politique);

	return reponse;
}

export const config = {
	/* Tout sauf ce qui n'est pas une page : les fichiers statiques, les images
	   déjà optimisées et le favicon n'ont aucun script à contraindre, et les
	   faire passer par le middleware coûterait une exécution par fichier.

	   Les webhooks (`/api/`) sont exclus aussi : ce sont des appels de serveur à
	   serveur, sans navigateur pour appliquer quoi que ce soit. */
	matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
