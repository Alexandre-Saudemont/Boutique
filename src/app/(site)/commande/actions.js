'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {creerCommande, validerAdresse} from '@/server/services/checkout';
import {getCartToken} from '@/server/auth/cart-session';
import {
	effacerBrouillonCommande,
	getBrouillonCommande,
	setBrouillonCommande,
} from '@/server/auth/checkout-session';

/* Actions du tunnel.

   Le formulaire d'adresse est validé deux fois : ici pour renvoyer les erreurs
   champ par champ à l'écran, et à nouveau dans `creerCommande`. Ce n'est pas
   une redondance inutile — la seconde est celle qui protège, la première celle
   qui explique. */

/// Récupère les champs d'adresse du formulaire, en une forme stable.
function lireAdresse(donnees) {
	return {
		firstName: donnees.get('firstName') ?? '',
		lastName: donnees.get('lastName') ?? '',
		line1: donnees.get('line1') ?? '',
		line2: donnees.get('line2') ?? '',
		postalCode: donnees.get('postalCode') ?? '',
		city: donnees.get('city') ?? '',
		phone: donnees.get('phone') ?? '',
		email: donnees.get('email') ?? '',
	};
}

/* Étape 2 : enregistre le mode de livraison et l'adresse, puis passe au
   paiement. Rien n'est écrit en base — tout va dans le cookie de brouillon. */
export async function enregistrerLivraison(_precedent, donnees) {
	const adresse = lireAdresse(donnees);
	const rateId = donnees.get('rateId');

	const controle = validerAdresse(adresse);

	if (!controle.valide) {
		return {statut: 'erreur', erreurs: controle.erreurs, adresse, rateId};
	}

	if (!rateId) {
		return {
			statut: 'erreur',
			erreurs: {rateId: 'Choisissez un mode de livraison.'},
			adresse,
			rateId,
		};
	}

	await setBrouillonCommande({adresse, rateId, note: donnees.get('note') || null});

	redirect('/commande/paiement');
}

/* Étape 3 : crée la commande.

   Le moyen de paiement est enregistré mais rien n'est débité : ni Stripe ni
   PayPal ne sont branchés. La commande naît donc en attente de paiement, ce
   qu'annonce l'écran de confirmation. Quand les clés arriveront, c'est ici que
   la redirection vers le prestataire s'insérera — le reste ne bouge pas. */
export async function payerCommande(_precedent, donnees) {
	const jeton = await getCartToken();
	const brouillon = await getBrouillonCommande();

	if (!brouillon) {
		return {
			statut: 'erreur',
			message: 'Vos informations de livraison ont expiré. Reprenez à l’étape précédente.',
		};
	}

	const resultat = await creerCommande({
		token: jeton,
		adresse: brouillon.adresse,
		rateId: brouillon.rateId,
		note: brouillon.note,
		provider: donnees.get('provider') === 'paypal' ? 'PAYPAL' : 'STRIPE',
	});

	if (!resultat.ok) {
		return {statut: 'erreur', message: resultat.erreur};
	}

	/* Le brouillon est remplacé par la référence de la commande : c'est ce qui
	   permet à l'écran de confirmation de la retrouver sans faire passer le
	   numéro et l'e-mail par l'URL. */
	await effacerBrouillonCommande();
	await setBrouillonCommande({
		commande: {numero: resultat.numero, email: brouillon.adresse.email},
	});

	revalidatePath('/', 'layout');
	redirect('/commande/confirmation');
}
