/* En-têtes de sécurité.

   Ils ne remplacent aucune vérification côté serveur : ce sont des garde-fous
   du navigateur, qui limitent les dégâts si une faille passe. Ils coûtent une
   ligne de configuration et se posent avant la mise en ligne, pas après.

   La Content-Security-Policy n'est pas ici : elle porte un `nonce` différent à
   chaque réponse et vit donc dans `src/middleware.js`, seul endroit capable de
   la reconstruire par requête. */
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

/* Les domaines d'où l'on accepte de charger des images.

   Next refuse par défaut toute image distante non déclarée, et c'est une bonne
   chose : son optimiseur va chercher l'URL depuis le serveur. Tout autoriser
   reviendrait à offrir un relais de requêtes — on lui ferait appeler une adresse
   interne (`http://169.254.169.254`, un service voisin) et lire la réponse.

   La liste vient de l'environnement pour ne pas avoir à redéployer à chaque
   nouvel hébergeur d'images. Format : `images.exemple.fr,cdn.autre.com`. */
const hotesImages = (process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? '')
	.split(',')
	.map((hote) => hote.trim())
	.filter(Boolean)
	.map((hostname) => ({protocol: 'https', hostname}));

/** @type {import('next').NextConfig} */
const nextConfig = {
	// Rien ne sert d'annoncer la technologie et sa version : c'est la première
	// chose que cherche un scan automatisé pour choisir ses exploits.
	poweredByHeader: false,

	images: {remotePatterns: hotesImages},

	async headers() {
		return [{source: '/:path*', headers: enTetesSecurite}];
	},
};

export default nextConfig;
