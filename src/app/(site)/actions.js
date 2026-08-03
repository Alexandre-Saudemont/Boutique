'use server';

import {subscribe} from '@/server/services/newsletter';

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

	const resultat = await subscribe(email, source);

	if (!resultat.ok) {
		// L'adresse saisie repart avec l'erreur : sans elle, le champ se
		// reconstruit vide et l'utilisateur doit tout retaper pour corriger.
		return {statut: 'erreur', message: resultat.erreur, email: String(email ?? '')};
	}

	return {statut: 'inscrit'};
}
