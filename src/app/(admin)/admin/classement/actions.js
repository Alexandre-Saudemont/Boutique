'use server';

import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {ACTIONS, journaliser} from '@/server/services/audit';
import {basculer, enregistrer, typeConnu} from '@/server/services/taxonomies';

/* Actions des rayons, marques et licences.

   Le type arrive du formulaire : il est donc vérifié ici avant tout. Sans ce
   contrôle, une valeur forgée choisirait la table dans laquelle écrire — le
   service lève dans ce cas, mais mieux vaut un message clair qu'une erreur
   serveur. */

function invalider() {
	// Le menu des rayons vit dans le header, donc dans le layout de la vitrine.
	revalidatePath('/', 'layout');
	revalidatePath('/admin/classement');
}

export async function sauvegarderEntree(_precedent, donnees) {
	const utilisateur = await exigerDroit('produits.gerer');

	const type = String(donnees.get('type') ?? '');

	if (!typeConnu(type)) {
		return {statut: 'erreur', message: 'Type de classement inconnu.'};
	}

	const resultat = await enregistrer(type, {
		id: donnees.get('id') || null,
		nom: donnees.get('nom'),
		actif: donnees.get('actif') === 'on',
		position: donnees.get('position'),
	});

	if (!resultat.ok) {
		return {statut: 'erreur', erreurs: resultat.erreurs, message: 'Corrigez les champs signalés.'};
	}

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.RAYON_MODIFIE,
		type,
		id: resultat.id,
		details: {nom: donnees.get('nom')},
	});

	invalider();

	return {statut: 'ok', message: 'Enregistré.'};
}

export async function basculerEntree(_precedent, donnees) {
	const utilisateur = await exigerDroit('produits.gerer');

	const type = String(donnees.get('type') ?? '');
	if (!typeConnu(type)) return {statut: 'erreur', message: 'Type de classement inconnu.'};

	const id = String(donnees.get('id'));
	const actif = donnees.get('actif') === '1';

	await basculer(type, id, actif);

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.RAYON_MODIFIE,
		type,
		id,
		details: {actif},
	});

	invalider();

	return {statut: 'ok'};
}
