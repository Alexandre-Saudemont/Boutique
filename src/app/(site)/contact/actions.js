'use server';

import {envoyerDemandeContact} from '@/server/services/contact';

/* L'envoi du formulaire de contact.

   Toute la validation et la limitation vivent dans le service : cette action
   ne fait que traduire le `FormData` du navigateur en argument, et la réponse
   du service en état pour `useActionState`.

   En cas d'erreur, la saisie repart avec — un message de trois cents mots
   perdu parce qu'on a mal tapé son adresse, c'est un visiteur qui n'écrit pas
   une seconde fois. */
export async function envoyerContact(_precedent, donnees) {
	const saisie = {
		nom: donnees.get('nom') ?? '',
		email: donnees.get('email') ?? '',
		sujet: donnees.get('sujet') ?? '',
		message: donnees.get('message') ?? '',
	};

	const resultat = await envoyerDemandeContact({...saisie, piege: donnees.get('site')});

	if (!resultat.ok) {
		return {statut: 'erreur', message: resultat.erreur, saisie};
	}

	return {statut: 'envoye'};
}
