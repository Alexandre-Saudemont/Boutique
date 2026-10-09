import 'server-only';
import {prisma} from '@/server/db';
import {urlImageAcceptable} from '@/server/services/product-admin';

/* La mascotte du header, programmée par période.

   Chaque ligne = une image + une fenêtre de dates. Le header affiche celle dont
   la fenêtre contient « maintenant » ; hors de toute période, il n'affiche rien
   (pas d'image par défaut tant que le client n'en a pas fourni une).

   L'adresse de l'image passe par le même contrôle que les photos produits
   (`urlImageAcceptable` : https seulement, pas d'adresse du réseau interne) :
   elle finit dans un attribut `src` de chaque page du site. */

/// La mascotte à afficher maintenant, ou `null`. Si deux périodes se
/// chevauchent, la plus récemment commencée l'emporte — c'est celle qu'on a
/// programmée en dernier pour l'occasion.
export async function getMascotteActive(maintenant = new Date()) {
	const mascotte = await prisma.headerMascot.findFirst({
		where: {isActive: true, startsAt: {lte: maintenant}, endsAt: {gte: maintenant}},
		orderBy: {startsAt: 'desc'},
		select: {imageUrl: true, alt: true},
	});

	return mascotte;
}

/// Toutes les périodes, pour l'écran d'administration : à venir et en cours
/// d'abord, les passées ensuite.
export async function listerMascottes() {
	return prisma.headerMascot.findMany({orderBy: {startsAt: 'desc'}});
}

/// Une date saisie (`YYYY-MM-DD`) en début ou fin de journée locale : la fin
/// inclut toute la journée, sinon une période « jusqu'au 1er novembre » s'arrêterait
/// à minuit au lieu de couvrir le 1er.
function dateSaisie(texte, finDeJournee) {
	const brut = String(texte ?? '').trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(brut)) return null;

	const date = new Date(`${brut}T${finDeJournee ? '23:59:59' : '00:00:00'}`);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function validerMascotte(saisie) {
	const erreurs = {};

	if (!String(saisie.nom ?? '').trim()) erreurs.nom = 'Donnez un nom à cette période.';

	if (!urlImageAcceptable(String(saisie.imageUrl ?? '').trim())) {
		erreurs.imageUrl =
			'L’adresse doit commencer par https:// et pointer vers une image publique.';
	}

	const debut = dateSaisie(saisie.debut, false);
	const fin = dateSaisie(saisie.fin, true);

	if (!debut) erreurs.debut = 'Date de début invalide.';
	if (!fin) erreurs.fin = 'Date de fin invalide.';
	if (debut && fin && fin < debut) erreurs.fin = 'La fin doit être après le début.';

	return {valide: Object.keys(erreurs).length === 0, erreurs, debut, fin};
}

export async function enregistrerMascotte(saisie) {
	const controle = validerMascotte(saisie);
	if (!controle.valide) return {ok: false, erreurs: controle.erreurs};

	const nom = String(saisie.nom).trim();

	const donnees = {
		name: nom,
		imageUrl: String(saisie.imageUrl).trim(),
		alt: String(saisie.alt ?? '').trim() || nom,
		startsAt: controle.debut,
		endsAt: controle.fin,
		isActive: Boolean(saisie.actif),
	};

	const mascotte = saisie.id
		? await prisma.headerMascot.update({where: {id: saisie.id}, data: donnees})
		: await prisma.headerMascot.create({data: donnees});

	return {ok: true, id: mascotte.id};
}

export async function supprimerMascotte(id) {
	await prisma.headerMascot.delete({where: {id}});
	return {ok: true};
}
