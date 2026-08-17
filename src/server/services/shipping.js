import 'server-only';
import {prisma} from '@/server/db';

/* Livraison.

   Les tarifs vivent en base et non dans le code : le client change de
   transporteur ou ajuste un prix depuis l'admin, sans redéploiement. Le franco
   de port est porté par chaque tarif (`freeAboveCents`) plutôt que par un
   réglage global, parce qu'il peut différer d'un mode à l'autre — le retrait à
   l'atelier est gratuit d'emblée, le relais et le domicile ont leur propre
   seuil. */

/// Les modes de livraison proposés, pour l'affichage. Le calcul réel des frais
/// se fera au tunnel de commande, en fonction du poids et de la destination.
export async function getModesLivraison() {
	const tarifs = await prisma.shippingRate.findMany({
		where: {isActive: true, zone: {isActive: true}},
		orderBy: [{position: 'asc'}, {priceCents: 'asc'}],
		select: {
			id: true,
			name: true,
			carrier: true,
			priceCents: true,
			freeAboveCents: true,
			estimatedDays: true,
			isRelayPoint: true,
		},
	});

	return tarifs;
}

/* ── Back-office ────────────────────────────────────────────────────────────
   À partir d'ici, on montre aussi les tarifs et les zones désactivés : c'est
   justement ce qu'on vient réactiver. */

/// Les zones avec leurs tarifs, pour l'écran de gestion.
export async function listerZones() {
	return prisma.shippingZone.findMany({
		orderBy: {name: 'asc'},
		include: {rates: {orderBy: [{position: 'asc'}, {priceCents: 'asc'}]}},
	});
}

export async function getTarif(id) {
	return prisma.shippingRate.findUnique({where: {id}, include: {zone: true}});
}

/* Valide la saisie d'un tarif.

   Le franco vide n'est pas une erreur : il signifie « ce mode n'a pas de
   livraison offerte ». Un zéro, lui, voudrait dire « toujours offerte » — les
   deux existent et ne se confondent pas. */
export function validerTarif(saisie) {
	const erreurs = {};

	if (!String(saisie.nom ?? '').trim()) erreurs.nom = 'Le nom est obligatoire.';
	if (!String(saisie.transporteur ?? '').trim()) {
		erreurs.transporteur = 'Le transporteur est obligatoire.';
	}
	if (!saisie.zoneId) erreurs.zoneId = 'Choisissez une zone.';

	if (montantEnCentimes(saisie.prix) === null) erreurs.prix = 'Prix invalide (ex. 5,90).';

	if (String(saisie.franco ?? '').trim() && montantEnCentimes(saisie.franco) === null) {
		erreurs.franco = 'Montant invalide. Laissez vide pour ne pas offrir la livraison.';
	}

	return {valide: Object.keys(erreurs).length === 0, erreurs};
}

/// Saisie en euros, stockage en centimes — comme partout dans le projet.
function montantEnCentimes(saisie) {
	const texte = String(saisie ?? '')
		.replace(/\s/g, '')
		.replace(',', '.');

	if (!/^\d+(\.\d{1,2})?$/.test(texte)) return null;

	return Math.round(Number(texte) * 100);
}

export {montantEnCentimes};

/* Crée ou met à jour un mode de livraison.

   Rien de destructif : un tarif retiré de la vente est désactivé, jamais
   supprimé. Des commandes passées portent son nom en copie, et le faire
   disparaître de la liste ne doit pas laisser croire qu'il n'a jamais existé. */
export async function enregistrerTarif(saisie) {
	const controle = validerTarif(saisie);
	if (!controle.valide) return {ok: false, erreurs: controle.erreurs};

	const franco = String(saisie.franco ?? '').trim();

	const donnees = {
		zoneId: saisie.zoneId,
		name: String(saisie.nom).trim(),
		carrier: String(saisie.transporteur).trim(),
		priceCents: montantEnCentimes(saisie.prix),
		freeAboveCents: franco ? montantEnCentimes(franco) : null,
		estimatedDays: String(saisie.delai ?? '').trim() || null,
		isRelayPoint: Boolean(saisie.pointRelais),
		isActive: Boolean(saisie.actif),
		position: Number(saisie.position) || 0,
	};

	const tarif = saisie.id
		? await prisma.shippingRate.update({where: {id: saisie.id}, data: donnees})
		: await prisma.shippingRate.create({data: donnees});

	return {ok: true, id: tarif.id};
}

/// Active ou désactive un mode. Un mode désactivé disparaît du tunnel de
/// commande mais reste lisible sur les commandes déjà passées.
export async function basculerTarif(id, actif) {
	await prisma.shippingRate.update({where: {id}, data: {isActive: Boolean(actif)}});

	return {ok: true};
}

/* Crée une zone.

   Les pays sont saisis en codes ISO à deux lettres (FR, BE, LU) : c'est ce que
   demandent les transporteurs et ce que le modèle stocke. La saisie les
   normalise en majuscules pour qu'une comparaison future ne dépende pas de la
   façon dont ils ont été tapés. */
export async function enregistrerZone({id, nom, pays, actif = true}) {
	const nomPropre = String(nom ?? '').trim();

	if (!nomPropre) return {ok: false, erreurs: {nom: 'Le nom est obligatoire.'}};

	const codes = String(pays ?? '')
		.split(',')
		.map((code) => code.trim().toUpperCase())
		.filter((code) => /^[A-Z]{2}$/.test(code));

	if (codes.length === 0) {
		return {ok: false, erreurs: {pays: 'Indiquez au moins un pays (FR, BE, LU…).'}};
	}

	const donnees = {name: nomPropre, countries: codes, isActive: Boolean(actif)};

	const zone = id
		? await prisma.shippingZone.update({where: {id}, data: donnees})
		: await prisma.shippingZone.create({data: donnees});

	return {ok: true, id: zone.id};
}
