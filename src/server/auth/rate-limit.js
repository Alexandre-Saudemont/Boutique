import 'server-only';

/* Limitation des tentatives.

   Sans elle, rien n'empêche d'essayer des milliers de mots de passe sur une
   adresse : scrypt rend chaque essai coûteux pour le serveur, pas pour
   l'attaquant qui les envoie en parallèle.

   Le compteur vit **en mémoire du processus**. C'est un choix assumé pour une
   boutique à faible trafic sur une seule instance, et c'est aussi sa limite :
   il repart à zéro au redéploiement, et deux instances derrière un répartiteur
   compteraient chacune de leur côté. Le jour où le site tourne sur plusieurs
   instances, ce fichier est le seul à remplacer — par Redis ou une table
   dédiée. L'interface ne bougera pas.

   La fenêtre est glissante : on garde l'horodatage de chaque tentative plutôt
   qu'un compteur remis à zéro toutes les quinze minutes. Un compteur fixe
   laisse passer deux fois la limite à cheval sur deux fenêtres. */

const tentatives = new Map();

/* Nettoyage : sans lui, la Map garde une entrée par adresse essayée, à vie.
   Déclenché à l'écriture plutôt que par un minuteur — un `setInterval` dans un
   module Next survit aux rechargements à chaud et s'empile. */
const INTERVALLE_NETTOYAGE = 5 * 60 * 1000;
let dernierNettoyage = Date.now();

function nettoyer(fenetreMs) {
	const limite = Date.now() - fenetreMs;

	for (const [cle, horodatages] of tentatives) {
		const restants = horodatages.filter((instant) => instant > limite);
		if (restants.length === 0) tentatives.delete(cle);
		else tentatives.set(cle, restants);
	}

	dernierNettoyage = Date.now();
}

/* Enregistre une tentative et dit si la limite est franchie.

   `cle` doit identifier la cible de l'attaque, pas l'utilisateur légitime :
   pour une connexion, l'adresse e-mail visée. La limiter par IP seule
   laisserait passer une attaque distribuée, et bloquerait tout un réseau
   d'entreprise partageant une sortie.

   Retourne `{autorise, resteSecondes}` — de quoi dire au visiteur combien de
   temps patienter plutôt que de lui opposer un refus opaque. */
export function verifierLimite(cle, {max = 10, fenetreMs = 15 * 60 * 1000} = {}) {
	if (Date.now() - dernierNettoyage > INTERVALLE_NETTOYAGE) {
		nettoyer(fenetreMs);
	}

	const maintenant = Date.now();
	const debut = maintenant - fenetreMs;

	const horodatages = (tentatives.get(cle) ?? []).filter((instant) => instant > debut);

	if (horodatages.length >= max) {
		const plusAncienne = horodatages[0];
		const resteMs = plusAncienne + fenetreMs - maintenant;

		return {autorise: false, resteSecondes: Math.max(1, Math.ceil(resteMs / 1000))};
	}

	horodatages.push(maintenant);
	tentatives.set(cle, horodatages);

	return {autorise: true, resteSecondes: 0};
}

/* Efface le compteur d'une clé. À appeler après une connexion réussie : sinon
   quelqu'un qui se trompe neuf fois puis réussit reste à une tentative de la
   porte close. */
export function reinitialiserLimite(cle) {
	tentatives.delete(cle);
}
