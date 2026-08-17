'use server';

import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {changerStatutCommande, enregistrerNoteAdmin, expedierColis} from '@/server/services/orders';
import {enregistrerContenuBox} from '@/server/services/boxes';
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

	const resultat = await changerStatutCommande({numero, statut});

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

/* Expédier un colis.
 *
 * Séparé de l'avancement de statut, parce que ce n'est pas le même geste : on
 * n'annonce pas un départ, on l'enregistre. C'est le service qui en déduit si la
 * commande devient « partiellement expédiée » ou « expédiée », pour qu'aucun
 * écran n'ait à refaire ce raisonnement. */
export async function expedierUnColis(_precedent, donnees) {
	const utilisateur = await exigerDroit('commandes.gerer');

	const numero = String(donnees.get('numero') ?? '');
	const colisId = String(donnees.get('colisId') ?? '');

	const resultat = await expedierColis({
		numero,
		colisId,
		suivi: donnees.get('suivi') || null,
		transporteur: donnees.get('transporteur') || null,
		url: donnees.get('url') || null,
	});

	if (!resultat.ok) return {statut: 'erreur', message: resultat.erreur};

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.COMMANDE_STATUT,
		type: 'order',
		id: numero,
		details: {statut: resultat.statut, colis: colisId},
	});

	revalidatePath('/admin', 'layout');

	return {
		statut: 'ok',
		message:
			resultat.statut === 'SHIPPED'
				? 'Colis expédié, la commande est complète.'
				: 'Colis expédié. Il en reste un à envoyer.',
	};
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

/* Contenu d'une box surprise.

   Une note en texte libre par box, écrite à la préparation. Le droit exigé est
   le même que pour faire avancer une commande : c'est le geste de celui qui
   emballe.

   Le texte n'entre pas au journal — il est saisi à la main et pourrait contenir
   n'importe quoi, y compris une remarque sur le client. Le journal se conserve
   bien plus longtemps que ça ne le justifie. */
export async function noterContenuBox(_precedent, donnees) {
	const utilisateur = await exigerDroit('commandes.gerer');

	const numero = String(donnees.get('numero') ?? '');

	const resultat = await enregistrerContenuBox({
		orderItemId: String(donnees.get('ligneId') ?? ''),
		boxNumber: donnees.get('boxNumber'),
		contenu: donnees.get('contenu'),
	});

	if (!resultat.ok) return {statut: 'erreur', message: resultat.erreur};

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.BOX_COMPOSEE,
		type: 'order',
		id: numero,
		details: {box: Number(donnees.get('boxNumber'))},
	});

	revalidatePath(`/admin/commandes/${numero}`);

	return {statut: 'ok'};
}
