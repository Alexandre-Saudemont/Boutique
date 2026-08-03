'use server';

import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {ACTIONS, journaliser} from '@/server/services/audit';
import {changerRole} from '@/server/services/customers';

/* Attribution des rôles.

   `personnel.gerer` est réservé à l'administrateur. C'est l'action la plus
   lourde du back-office : elle décide de qui peut faire quoi, y compris voir le
   chiffre d'affaires.

   Elle est toujours journalisée, y compris son auteur : c'est précisément le
   genre de changement qu'on veut pouvoir retracer six mois plus tard. */
export async function attribuerRole(_precedent, donnees) {
	const utilisateur = await exigerDroit('personnel.gerer');

	const cibleId = String(donnees.get('id') ?? '');
	const role = String(donnees.get('role') ?? '');

	const resultat = await changerRole({cibleId, role, auteurId: utilisateur.id});

	if (!resultat.ok) return {statut: 'erreur', message: resultat.erreur};

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.ROLE_MODIFIE,
		type: 'user',
		id: cibleId,
		details: {role},
	});

	revalidatePath('/admin/clients');

	return {statut: 'ok', message: 'Rôle mis à jour. La personne devra se reconnecter.'};
}
