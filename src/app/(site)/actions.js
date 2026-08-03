'use server';

import {subscribe} from '@/server/services/newsletter';
import {verifierLimite} from '@/server/auth/rate-limit';

/* Actions serveur de la vitrine.

   Une action serveur remplace ce qui aurait été une route POST : le formulaire
   la vise directement, Next se charge du transport. Elle vit dans `src/app`
   parce qu'elle appartient au front — mais elle ne touche pas Prisma, elle
   appelle le service, comme n'importe quelle page.

   Sa forme (état précédent, données du formulaire) est celle qu'attend
   `useActionState` côté navigateur. */

export async function inscrireNewsletter(_precedent, donnees) {
	const email = donnees.get('email');
	const source = donnees.get('source') ?? null;

	/* Le formulaire est public et sans compte : sans limite, il sert à remplir la
	   liste de milliers d'adresses inventées, ou à inscrire de force celle de
	   quelqu'un d'autre en boucle.

	   La limite porte sur l'adresse visée, comme pour la connexion. Elle est
	   large — cinq inscriptions par heure sur la même adresse — parce qu'un
	   visiteur qui doute et reclique ne doit jamais s'y heurter. */
	const limite = verifierLimite(`newsletter:${String(email ?? '').trim().toLowerCase()}`, {
		max: 5,
		fenetreMs: 60 * 60 * 1000,
	});

	if (!limite.autorise) {
		// Message volontairement identique au succès : distinguer les deux
		// dirait à un curieux que l'adresse a déjà été soumise.
		return {statut: 'inscrit'};
	}

	const resultat = await subscribe(email, source);

	if (!resultat.ok) {
		// L'adresse saisie repart avec l'erreur : sans elle, le champ se
		// reconstruit vide et l'utilisateur doit tout retaper pour corriger.
		return {statut: 'erreur', message: resultat.erreur, email: String(email ?? '')};
	}

	return {statut: 'inscrit'};
}
