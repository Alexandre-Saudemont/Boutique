'use server';

import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {changerStatutCommande, enregistrerNoteAdmin} from '@/server/services/orders';
import {ACTIONS, journaliser} from '@/server/services/audit';

/* Actions du back-office sur une commande.

   Chacune revérifie le droit. Une action serveur est un point d'entrée HTTP à
   part entière : elle s'appelle depuis n'importe où, sans passer par la page
   qui l'affiche. Se reposer sur le contrôle du layout laisserait la porte
   ouverte à qui connaît son nom. */

export async function avancerCommande(_precedent, donnees) {
	const utilisateur = await exigerDroit('commandes.gerer');

	const numero = String(donnees.get('numero') ?? '');
	const statut = String(donnees.get('statut') ?? '');

	const resultat = await changerStatutCommande({
		numero,
		statut,
		suivi: donnees.get('suivi') || null,
		transporteur: donnees.get('transporteur') || null,
	});

	if (!resultat.ok) return {statut: 'erreur', message: resultat.erreur};

	/* Journalisé après coup, et seulement si l'action a abouti : un journal qui
	   consigne des tentatives refusées devient illisible. */
	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.COMMANDE_STATUT,
		type: 'order',
		id: numero,
		details: {statut},
	});

	/* La fiche, la liste et le tableau de bord montrent tous ce statut, et la
	   barre latérale porte le compteur : on invalide le layout du back-office
	   plutôt que chaque page une à une. */
	revalidatePath('/admin', 'layout');

	return {statut: 'ok', message: 'Commande mise à jour.'};
}

export async function noterCommande(_precedent, donnees) {
	const utilisateur = await exigerDroit('commandes.gerer');
	const numero = String(donnees.get('numero') ?? '');

	await enregistrerNoteAdmin(numero, donnees.get('note'));

	// Le texte de la note n'entre pas dans le journal : il peut contenir des
	// éléments personnels sur le client, que le journal conserverait bien plus
	// longtemps que nécessaire.
	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.COMMANDE_NOTE,
		type: 'order',
		id: numero,
	});

	revalidatePath('/admin/commandes');

	return {statut: 'ok', message: 'Note enregistrée.'};
}
