/* En-têtes de sécurité.

   Ils ne remplacent aucune vérification côté serveur : ce sont des garde-fous
   du navigateur, qui limitent les dégâts si une faille passe. Ils coûtent une
   ligne de configuration et se posent avant la mise en ligne, pas après.

   Volontairement pas de Content-Security-Policy pour l'instant : une CSP posée
   à la va-vite casse silencieusement les scripts de Next, et une CSP qui
   autorise `unsafe-inline` ne protège de rien. Elle demande des `nonce` par
   requête, donc un middleware — à faire avant la mise en production, avec de
   quoi la tester. */
const enTetesSecurite = [
	{
		/* Empêche le site d'être chargé dans une iframe : sans ça, une page
		   malveillante peut le superposer, invisible, sous ses propres boutons et
		   faire cliquer le visiteur là où il ne croit pas cliquer. */
		key: 'X-Frame-Options',
		value: 'DENY',
	},
	{
		/* Bloque la « reniflage » du type de contenu. Un fichier téléversé qui
		   ressemble à du JavaScript ne sera pas exécuté comme tel. */
		key: 'X-Content-Type-Options',
		value: 'nosniff',
	},
	{
		/* L'URL complète ne part que vers nos propres pages ; vers l'extérieur,
		   seul le domaine est transmis. Une adresse e-mail ou un numéro de
		   commande dans une URL ne fuite pas chez un tiers. */
		key: 'Referrer-Policy',
		value: 'strict-origin-when-cross-origin',
	},
	{
		/* Aucune page n'a besoin de la caméra, du micro ou de la position. Le dire
		   explicitement coupe l'accès à un script tiers qui les demanderait. */
		key: 'Permissions-Policy',
		value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
	},
	{
		/* HSTS : le navigateur refusera le HTTP en clair sur ce domaine pendant
		   deux ans. Sans effet en développement (localhost reste joignable), et
		   décisif en production — il ferme la fenêtre où une première requête HTTP
		   peut être détournée. */
		key: 'Strict-Transport-Security',
		value: 'max-age=63072000; includeSubDomains; preload',
	},
];

/** @type {import('next').NextConfig} */
const nextConfig = {
	async headers() {
		return [{source: '/:path*', headers: enTetesSecurite}];
	},
};

export default nextConfig;
