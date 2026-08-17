'use server';

import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {ACTIONS, journaliser} from '@/server/services/audit';
import {modererAvis, repondreAvis} from '@/server/services/reviews';

/* Modération des avis.

   Le droit `avis.moderer` appartient à l'administrateur et au service client :
   c'est exactement le genre de tâche qu'on délègue à qui répond déjà aux
   clients, et qui n'a rien à voir avec la préparation des colis. */

export async function decider(_precedent, donnees) {
	const utilisateur = await exigerDroit('avis.moderer');

	const id = String(donnees.get('id'));
	const statut = String(donnees.get('statut'));

	const resultat = await modererAvis(id, statut);

	if (!resultat.ok) return {statut: 'erreur', message: resultat.erreur};

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.AVIS_MODERE,
		type: 'review',
		id,
		details: {decision: statut},
	});

	revalidatePath('/admin/avis');
	// La fiche produit affiche les avis publiés et la note moyenne.
	revalidatePath('/', 'layout');

	return {statut: 'ok'};
}

export async function repondre(_precedent, donnees) {
	const utilisateur = await exigerDroit('avis.moderer');

	const id = String(donnees.get('id'));

	await repondreAvis(id, donnees.get('reponse'));

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.AVIS_REPONDU,
		type: 'review',
		id,
	});

	revalidatePath('/admin/avis');
	revalidatePath('/', 'layout');

	return {statut: 'ok', message: 'Réponse enregistrée.'};
}
