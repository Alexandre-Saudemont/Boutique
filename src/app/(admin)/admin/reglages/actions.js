'use server';

import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {REGLAGES_MODIFIABLES, enregistrerReglages} from '@/server/services/settings';
import {ACTIONS, journaliser} from '@/server/services/audit';

export async function sauvegarderReglages(_precedent, donnees) {
	const utilisateur = await exigerDroit('reglages.gerer');

	await enregistrerReglages(donnees);

	/* Les clés touchées sont journalisées, pas leurs valeurs : savoir que le
	   régime de TVA a été modifié suffit à retrouver la trace, et la valeur
	   courante se lit dans la table des réglages. */
	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.REGLAGES_MODIFIES,
		type: 'settings',
		id: 'global',
		details: {cles: [...donnees.keys()].filter((cle) => cle in REGLAGES_MODIFIABLES)},
	});

	/* Ces réglages se lisent partout : bandeau d'annonce dans le header,
	   ouverture de la boutique dans le tunnel, franco de port sur la fiche
	   produit. On invalide donc tout le site, pas seulement cette page. */
	revalidatePath('/', 'layout');
	revalidatePath('/admin/reglages');

	return {statut: 'ok', message: 'Réglages enregistrés.'};
}
