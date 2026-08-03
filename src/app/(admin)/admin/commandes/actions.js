'use server';

import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {changerStatutCommande, enregistrerNoteAdmin} from '@/server/services/orders';

/* Actions du back-office sur une commande.

   Chacune revérifie le droit. Une action serveur est un point d'entrée HTTP à
   part entière : elle s'appelle depuis n'importe où, sans passer par la page
   qui l'affiche. Se reposer sur le contrôle du layout laisserait la porte
   ouverte à qui connaît son nom. */

export async function avancerCommande(_precedent, donnees) {
	await exigerDroit('commandes.gerer');

	const numero = String(donnees.get('numero') ?? '');
	const statut = String(donnees.get('statut') ?? '');

	const resultat = await changerStatutCommande({
		numero,
		statut,
		suivi: donnees.get('suivi') || null,
		transporteur: donnees.get('transporteur') || null,
	});

	if (!resultat.ok) return {statut: 'erreur', message: resultat.erreur};

	/* La fiche, la liste et le tableau de bord montrent tous ce statut, et la
	   barre latérale porte le compteur : on invalide le layout du back-office
	   plutôt que chaque page une à une. */
	revalidatePath('/admin', 'layout');

	return {statut: 'ok', message: 'Commande mise à jour.'};
}

export async function noterCommande(_precedent, donnees) {
	await exigerDroit('commandes.gerer');

	await enregistrerNoteAdmin(String(donnees.get('numero') ?? ''), donnees.get('note'));

	revalidatePath('/admin/commandes');

	return {statut: 'ok', message: 'Note enregistrée.'};
}
