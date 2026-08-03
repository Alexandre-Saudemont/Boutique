import 'server-only';
import {cookies} from 'next/headers';

/* Les choix en cours du tunnel : mode de livraison et adresse.

   Ils vivent dans un cookie et non en base parce qu'aucune commande n'existe
   encore. Créer une `Order` dès l'étape livraison remplirait la table de
   commandes fantômes — un visiteur sur deux abandonne avant de payer. La
   commande naît au moment où l'on tente de payer, pas avant.

   Le cookie est `httpOnly` et n'est jamais cru sur parole : le mode de livraison
   est revérifié en base et le total recalculé au moment de créer la commande.
   Ce qu'il contient est un brouillon, pas une source de vérité.

   Il porte des données personnelles (nom, adresse) : durée courte — le temps de
   finir un achat, pas de revenir dans un mois — et effacement dès la commande
   passée. */

const NOM_COOKIE = 'commande';
const DUREE_SECONDES = 60 * 60 * 4; // quatre heures

export async function getBrouillonCommande() {
	const boite = await cookies();
	const brut = boite.get(NOM_COOKIE)?.value;
	if (!brut) return null;

	try {
		return JSON.parse(brut);
	} catch {
		// Cookie tronqué ou trafiqué : on repart d'un formulaire vide plutôt que
		// de faire échouer la page.
		return null;
	}
}

export async function setBrouillonCommande(brouillon) {
	const boite = await cookies();

	boite.set(NOM_COOKIE, JSON.stringify(brouillon), {
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: DUREE_SECONDES,
	});
}

export async function effacerBrouillonCommande() {
	const boite = await cookies();
	boite.delete(NOM_COOKIE);
}
