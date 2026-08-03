'use server';

import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {enregistrerReglages} from '@/server/services/settings';

export async function sauvegarderReglages(_precedent, donnees) {
	await exigerDroit('reglages.gerer');

	await enregistrerReglages(donnees);

	/* Ces réglages se lisent partout : bandeau d'annonce dans le header,
	   ouverture de la boutique dans le tunnel, franco de port sur la fiche
	   produit. On invalide donc tout le site, pas seulement cette page. */
	revalidatePath('/', 'layout');
	revalidatePath('/admin/reglages');

	return {statut: 'ok', message: 'Réglages enregistrés.'};
}
