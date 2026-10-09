'use server';

import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {ACTIONS, journaliser} from '@/server/services/audit';
import {enregistrerMascotte, supprimerMascotte} from '@/server/services/mascottes';

/* Actions de la mascotte du header.

   Même droit que les autres réglages d'apparence de la boutique
   (`reglages.gerer`). Le header est dans le layout de la vitrine : toute la
   vitrine se régénère après un changement. */

function invalider() {
	revalidatePath('/', 'layout');
	revalidatePath('/admin/mascotte');
}

export async function sauvegarderMascotte(_precedent, donnees) {
	const utilisateur = await exigerDroit('reglages.gerer');

	const saisie = {
		id: donnees.get('id') || null,
		nom: donnees.get('nom'),
		imageUrl: donnees.get('imageUrl'),
		alt: donnees.get('alt'),
		debut: donnees.get('debut'),
		fin: donnees.get('fin'),
		actif: donnees.get('actif') === 'on',
	};

	const resultat = await enregistrerMascotte(saisie);

	/* La saisie repart avec l'erreur : React 19 vide les champs non contrôlés
	   après chaque envoi, et sans ça une adresse mal tapée ferait perdre le
	   reste du formulaire. */
	if (!resultat.ok) {
		return {
			statut: 'erreur',
			erreurs: resultat.erreurs,
			message: 'Corrigez les champs signalés.',
			valeurs: saisie,
		};
	}

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.MASCOTTE_MODIFIEE,
		type: 'header_mascot',
		id: resultat.id,
		details: {nom: donnees.get('nom')},
	});

	invalider();

	return {statut: 'ok', message: 'Période enregistrée.'};
}

export async function retirerMascotte(_precedent, donnees) {
	const utilisateur = await exigerDroit('reglages.gerer');
	const id = String(donnees.get('id') ?? '');

	await supprimerMascotte(id);

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.MASCOTTE_MODIFIEE,
		type: 'header_mascot',
		id,
		details: {supprimee: true},
	});

	invalider();

	return {statut: 'ok'};
}
