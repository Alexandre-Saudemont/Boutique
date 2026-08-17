import 'server-only';

/* D'où vient cette requête ?

   Les Server Actions de Next vérifient l'origine toutes seules. Un gestionnaire
   de route, lui, ne vérifie rien : n'importe quel site peut faire poster le
   navigateur d'un visiteur vers le nôtre, avec ses cookies.

   Sur les routes de téléchargement, l'attaque est modeste — l'attaquant ne peut
   pas lire la réponse, il ne gagne rien — mais il peut faire **brûler** les cinq
   téléchargements d'un lien, ou déclencher des envois de fichiers en boucle. Ça
   suffit à justifier trois lignes.

   `Sec-Fetch-Site` est posé par le navigateur lui-même : une page ne peut pas le
   forger. On refuse quand il dit `cross-site`, et on laisse passer quand il est
   absent — les navigateurs qui ne l'envoient pas sont anciens, et refuser par
   défaut casserait leur téléchargement sans rien protéger de plus. */
export function estRequeteDuSite(requete) {
	const provenance = requete.headers.get('sec-fetch-site');

	return provenance !== 'cross-site';
}
