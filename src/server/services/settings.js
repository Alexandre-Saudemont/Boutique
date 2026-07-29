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
