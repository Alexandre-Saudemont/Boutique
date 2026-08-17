import {
	confirmerPaiement,
	echecPaiement,
	enregistrerRemboursement,
	lireEvenementStripe,
} from '@/server/services/payments';

/* Webhook Stripe.

   C'est la seule chose qui vaille preuve de paiement. Le retour du visiteur sur
   la page de confirmation, lui, ne prouve rien : cette URL se tape à la main, et
   le navigateur peut se fermer avant. Stripe appelle donc ce point d'entrée de
   serveur à serveur, et c'est cet appel — signé — qui marque la commande payée.

   `src/app/api/` n'existe que pour ça : des clients externes qui ont besoin
   d'une vraie route HTTP. Le reste du site passe par des services appelés
   directement depuis les pages.

   En développement, relayer les événements avec :
     stripe listen --forward-to localhost:3000/api/webhooks/stripe
   La commande affiche le `whsec_…` à mettre dans STRIPE_WEBHOOK_SECRET. */

// Le corps doit être lu brut, octet pour octet, pour que la signature se
// vérifie : c'est le corps exact qui a été signé, pas sa version reparsée.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(requete) {
	const corps = await requete.text();
	const signature = requete.headers.get('stripe-signature');

	let evenement;

	try {
		evenement = await lireEvenementStripe(corps, signature);
	} catch (erreur) {
		/* Signature absente, invalide, ou secret non configuré : on refuse sans
		   rien exécuter. Le message reste vague côté réponse — un attaquant n'a
		   pas à savoir ce qui n'a pas collé. */
		console.error('[stripe] signature refusée :', erreur.message);
		return new Response('Signature invalide.', {status: 400});
	}

	try {
		switch (evenement.type) {
			/* Paiement immédiat (carte) : la session est complétée et déjà payée.
			   Le contrôle sur `payment_status` écarte le cas d'un moyen de paiement
			   différé, qui complète la session avant que l'argent n'arrive. */
			case 'checkout.session.completed': {
				const session = evenement.data.object;
				if (session.payment_status === 'paid') await confirmerPaiement(session);
				break;
			}

			// Paiement différé (virement, prélèvement) : l'argent est arrivé.
			case 'checkout.session.async_payment_succeeded':
				await confirmerPaiement(evenement.data.object);
				break;

			case 'checkout.session.async_payment_failed':
				await echecPaiement(evenement.data.object, 'Paiement refusé par la banque.');
				break;

			// L'heure de validité de la session est passée sans paiement.
			case 'checkout.session.expired':
				await echecPaiement(evenement.data.object, 'Session de paiement expirée.');
				break;

			case 'charge.refunded':
				await enregistrerRemboursement(evenement.data.object);
				break;

			/* Tous les autres événements sont ignorés volontairement. Stripe en
			   envoie beaucoup ; répondre 200 lui dit « bien reçu, rien à faire »
			   et évite qu'il les rejoue indéfiniment. */
			default:
				break;
		}
	} catch (erreur) {
		/* Une erreur de traitement mérite un 500 : Stripe rejouera l'événement,
		   et `confirmerPaiement` sait ne pas s'appliquer deux fois. */
		console.error(`[stripe] échec du traitement de ${evenement.type} :`, erreur);
		return new Response('Traitement en échec.', {status: 500});
	}

	return Response.json({recu: true});
}
