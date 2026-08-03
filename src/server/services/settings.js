import 'server-only';
import {prisma} from '@/server/db';

/* Réglages d'exploitation.

   Tout ce qui doit pouvoir changer sans redéploiement vit en base : seuil de
   franco de port, texte du bandeau, régime de TVA, ouverture de la boutique.
   Une constante en dur dans le code obligerait le client à me rappeler pour
   changer « 50 € » en « 60 € ». */

const DEFAUTS = {
	'shop.name': "L'antre du vieux geek fou",
	'shop.open': false,
	'shop.announcement': '',
	'vat.regime': 'FRANCHISE',
	'shipping.freeAboveCents': 5000,
	'order.minimumCents': 0,
	'checkout.guestAllowed': true,
	'reviews.moderation': 'PRIOR',
};

/// Lit un réglage. Retourne la valeur par défaut si la clé n'est pas en base —
/// une base fraîche ou un seed non lancé ne doit pas casser l'affichage.
export async function getSetting(key) {
	const reglage = await prisma.setting.findUnique({where: {key}});
	return reglage ? reglage.value : (DEFAUTS[key] ?? null);
}

/// Lit tous les réglages d'un coup, défauts compris. À préférer quand une page
/// en consulte plusieurs : une requête au lieu de N.
export async function getSettings() {
	const reglages = await prisma.setting.findMany();
	const parCle = Object.fromEntries(reglages.map((r) => [r.key, r.value]));
	return {...DEFAUTS, ...parCle};
}

export async function setSetting(key, value) {
	return prisma.setting.upsert({
		where: {key},
		update: {value},
		create: {key, value},
	});
}

/* Ce que le back-office a le droit de modifier, et sous quelle forme.

   La liste est fermée à dessein : un formulaire ne doit pas pouvoir inventer
   une clé de réglage. Une clé inconnue postée depuis le navigateur passerait
   sinon en base, où personne ne la lirait jamais — et où elle pourrait écraser
   un réglage lu par le code sous un autre nom.

   Le type sert à reconvertir : un formulaire HTML ne renvoie que des chaînes,
   alors que `Setting.value` est du JSON typé. « 5000 » et 5000 ne se comparent
   pas de la même façon dans un calcul de franco de port. */
export const REGLAGES_MODIFIABLES = {
	'shop.name': {type: 'texte', libelle: 'Nom de la boutique'},
	'shop.open': {
		type: 'booleen',
		libelle: 'Boutique ouverte',
		aide: 'Décoché, le tunnel de commande est fermé : le catalogue reste visible mais rien ne peut être acheté.',
	},
	'shop.announcement': {
		type: 'texte',
		libelle: 'Bandeau d’annonce',
		aide: 'Affiché en haut de toutes les pages. Laisser vide pour ne rien afficher.',
	},
	'vat.regime': {
		type: 'choix',
		libelle: 'Régime de TVA',
		options: [
			{valeur: 'FRANCHISE', libelle: 'Franchise en base (art. 293 B) — pas de TVA facturée'},
			{valeur: 'STANDARD', libelle: 'TVA facturée'},
		],
		aide: 'Change les mentions des factures et le calcul des prix. À faire confirmer par votre comptable.',
	},
	'shipping.freeAboveCents': {
		type: 'euros',
		libelle: 'Livraison offerte à partir de',
		aide: 'Seuil par défaut. Chaque mode de livraison peut avoir le sien.',
	},
	'order.minimumCents': {
		type: 'euros',
		libelle: 'Montant minimum de commande',
		aide: 'Zéro pour ne pas imposer de minimum.',
	},
	'checkout.guestAllowed': {
		type: 'booleen',
		libelle: 'Commande sans compte',
		aide: 'Obliger à créer un compte fait abandonner une partie des acheteurs au moment de payer.',
	},
};

/* Convertit une valeur saisie vers le type attendu par la clé.

   Renvoie `undefined` si la saisie ne tient pas : l'appelant l'ignore alors
   plutôt que d'écrire une valeur bancale. Un franco de port passé à `NaN`
   rendrait toutes les comparaisons fausses et la livraison jamais offerte. */
function convertir(cle, saisie) {
	const descripteur = REGLAGES_MODIFIABLES[cle];
	if (!descripteur) return undefined;

	switch (descripteur.type) {
		case 'booleen':
			return saisie === 'on' || saisie === 'true' || saisie === true;

		case 'euros': {
			// Saisi en euros, stocké en centimes — comme tout montant du projet.
			const texte = String(saisie ?? '')
				.replace(/\s/g, '')
				.replace(',', '.');

			if (!/^\d+(\.\d{1,2})?$/.test(texte)) return undefined;

			return Math.round(Number(texte) * 100);
		}

		case 'choix':
			return descripteur.options.some((option) => option.valeur === saisie)
				? String(saisie)
				: undefined;

		default:
			return String(saisie ?? '').trim();
	}
}

/* Enregistre plusieurs réglages d'un coup.

   Les cases à cocher non cochées ne sont pas envoyées par le navigateur : pour
   les booléens, une absence vaut « faux ». Sans ce traitement, décocher
   « boutique ouverte » n'aurait aucun effet — le pire des bugs de réglage,
   celui qu'on ne remarque qu'en constatant que rien n'a changé. */
export async function enregistrerReglages(donnees) {
	const ecritures = [];

	for (const [cle, descripteur] of Object.entries(REGLAGES_MODIFIABLES)) {
		const brut = donnees.get(cle);

		if (brut === null && descripteur.type !== 'booleen') continue;

		const valeur = convertir(cle, descripteur.type === 'booleen' ? (brut ?? false) : brut);

		if (valeur === undefined) continue;

		ecritures.push(
			prisma.setting.upsert({where: {key: cle}, update: {value: valeur}, create: {key: cle, value: valeur}}),
		);
	}

	await prisma.$transaction(ecritures);

	return {ok: true};
}
