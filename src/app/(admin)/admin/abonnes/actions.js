'use server';

import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {desinscrireAbonne} from '@/server/services/newsletter';

export async function retirerAbonne(_precedent, donnees) {
	await exigerDroit('abonnes.voir');

	await desinscrireAbonne(String(donnees.get('id')));

	revalidatePath('/admin/abonnes');

	return {statut: 'ok', message: 'Adresse retirée de la liste.'};
}
