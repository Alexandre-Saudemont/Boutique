'use server';

import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {desinscrireAbonne} from '@/server/services/newsletter';
import {ACTIONS, journaliser} from '@/server/services/audit';

export async function retirerAbonne(_precedent, donnees) {
	const utilisateur = await exigerDroit('abonnes.voir');
	const id = String(donnees.get('id'));

	await desinscrireAbonne(id);

	/* Journalisé sans l'adresse : le geste est tracé, la donnée personnelle
	   reste dans la seule table qui a vocation à la porter. */
	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.ABONNE_RETIRE,
		type: 'newsletter_subscriber',
		id,
	});

	revalidatePath('/admin/abonnes');

	return {statut: 'ok', message: 'Adresse retirée de la liste.'};
}
