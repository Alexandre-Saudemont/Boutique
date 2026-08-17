'use server';

import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {ACTIONS, journaliser} from '@/server/services/audit';
import {basculerTarif, enregistrerTarif, enregistrerZone} from '@/server/services/shipping';

/* Actions de la livraison.

   Le droit demandé est `reglages.gerer` : changer un tarif de port revient à
   changer un prix de vente. Ce n'est pas au préparateur d'en décider. */

function invalider() {
	// Les tarifs s'affichent au panier, au tunnel et sur la fiche produit
	// (« livraison offerte dès… ») : c'est tout le site qui doit se régénérer.
	revalidatePath('/', 'layout');
	revalidatePath('/admin/livraison');
}

export async function sauvegarderTarif(_precedent, donnees) {
	const utilisateur = await exigerDroit('reglages.gerer');

	const resultat = await enregistrerTarif({
		id: donnees.get('id') || null,
		zoneId: donnees.get('zoneId'),
		nom: donnees.get('nom'),
		transporteur: donnees.get('transporteur'),
		prix: donnees.get('prix'),
		franco: donnees.get('franco'),
		delai: donnees.get('delai'),
		pointRelais: donnees.get('pointRelais') === 'on',
		actif: donnees.get('actif') === 'on',
		position: donnees.get('position'),
	});

	if (!resultat.ok) {
		return {statut: 'erreur', erreurs: resultat.erreurs, message: 'Corrigez les champs signalés.'};
	}

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.LIVRAISON_MODIFIEE,
		type: 'shipping_rate',
		id: resultat.id,
		details: {nom: donnees.get('nom'), prix: donnees.get('prix')},
	});

	invalider();

	return {statut: 'ok', message: 'Mode de livraison enregistré.'};
}

export async function basculer(_precedent, donnees) {
	const utilisateur = await exigerDroit('reglages.gerer');

	const id = String(donnees.get('id'));
	const actif = donnees.get('actif') === '1';

	await basculerTarif(id, actif);

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.LIVRAISON_MODIFIEE,
		type: 'shipping_rate',
		id,
		details: {actif},
	});

	invalider();

	return {statut: 'ok'};
}

export async function sauvegarderZone(_precedent, donnees) {
	const utilisateur = await exigerDroit('reglages.gerer');

	const resultat = await enregistrerZone({
		id: donnees.get('id') || null,
		nom: donnees.get('nom'),
		pays: donnees.get('pays'),
		actif: donnees.get('actif') !== 'off',
	});

	if (!resultat.ok) {
		return {statut: 'erreur', erreurs: resultat.erreurs, message: 'Corrigez les champs signalés.'};
	}

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.LIVRAISON_MODIFIEE,
		type: 'shipping_zone',
		id: resultat.id,
	});

	invalider();

	return {statut: 'ok', message: 'Zone enregistrée.'};
}
