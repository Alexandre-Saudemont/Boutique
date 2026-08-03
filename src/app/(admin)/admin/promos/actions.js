'use server';

import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {ACTIONS, journaliser} from '@/server/services/audit';
import {basculerCode, enregistrerCode} from '@/server/services/discounts';

/* Codes de réduction.

   `reglages.gerer` : accorder une remise, c'est décider d'un prix de vente.
   Le préparateur n'a pas à pouvoir créer un code à 90 %. */

export async function sauvegarderCode(_precedent, donnees) {
	const utilisateur = await exigerDroit('reglages.gerer');

	const resultat = await enregistrerCode({
		id: donnees.get('id') || null,
		code: donnees.get('code'),
		description: donnees.get('description'),
		type: donnees.get('type'),
		valeur: donnees.get('valeur'),
		minimum: donnees.get('minimum'),
		debut: donnees.get('debut'),
		fin: donnees.get('fin'),
		maxUtilisations: donnees.get('maxUtilisations'),
		actif: donnees.get('actif') === 'on',
	});

	if (!resultat.ok) {
		return {statut: 'erreur', erreurs: resultat.erreurs, message: 'Corrigez les champs signalés.'};
	}

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.PROMO_MODIFIEE,
		type: 'discount_code',
		id: resultat.id,
		details: {code: String(donnees.get('code') ?? '').toUpperCase()},
	});

	revalidatePath('/admin/promos');

	return {statut: 'ok', message: 'Code enregistré.'};
}

export async function basculer(_precedent, donnees) {
	const utilisateur = await exigerDroit('reglages.gerer');

	const id = String(donnees.get('id'));
	const actif = donnees.get('actif') === '1';

	await basculerCode(id, actif);

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.PROMO_MODIFIEE,
		type: 'discount_code',
		id,
		details: {actif},
	});

	revalidatePath('/admin/promos');

	return {statut: 'ok'};
}
