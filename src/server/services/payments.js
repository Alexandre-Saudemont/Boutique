import 'server-only';
import Stripe from 'stripe';
import {prisma} from '@/server/db';
import {envoyerConfirmationCommande} from '@/server/email/messages';

/* L'encaissement.

   **Le numéro de carte ne traverse jamais ce site.** On utilise la page de
   paiement hébergée par Stripe (Checkout) : le visiteur quitte la boutique le
   temps de payer et revient. C'est ce qui nous dispense de la certification
   PCI-DSS, et ce qui fait que ni ce fichier ni la base ne verront jamais un
   numéro de carte.

   **Ce que le navigateur renvoie ne vaut rien.** Le retour du client sur la page
   de confirmation ne prouve pas qu'il a payé : l'URL de retour se tape à la
   main. Seul le webhook — appelé de serveur à serveur, avec une signature
   vérifiée — a le droit de marquer une commande payée.

   **Tout est rejouable.** Stripe renvoie le même événement plusieurs fois s'il
   n'obtient pas de réponse claire. Chaque écriture doit donc pouvoir arriver
   deux fois sans doubler le stock décrémenté ni le paiement enregistré : c'est
   le rôle du garde `status !== 'PENDING_PAYMENT'` dans `confirmerPaiement`. */

let client = null;

/// Vrai si les clés sont renseignées. Sans elles, le tunnel retombe sur son
/// comportement d'origine : commande enregistrée, paiement à régler à la main.
export function paiementEnLigneActif() {
	return Boolean(process.env.STRIPE_SECRET_KEY);
}

function stripe() {
	if (!process.env.STRIPE_SECRET_KEY) {
		throw new Error('STRIPE_SECRET_KEY absente : le paiement en ligne est inactif.');
	}

	/* Deux tentatives en cas de coupure réseau. Stripe attache une clé
	   d'idempotence à ces rejeux, donc une requête relancée ne crée pas une
	   seconde session de paiement. */
	client ??= new Stripe(process.env.STRIPE_SECRET_KEY, {maxNetworkRetries: 2});

	return client;
}

/* Ouvre une session de paiement pour une commande, et renvoie l'URL vers
   laquelle rediriger le visiteur.

   Les lignes envoyées à Stripe sont celles de la commande, pas celles du
   panier : la commande a déjà figé les prix et recalculé le total côté serveur.
   Ce qui est débité correspond donc exactement à ce qui est facturé. */
export async function creerSessionPaiement({commandeId, jetonPanier, origine}) {
	const commande = await prisma.order.findUnique({
		where: {id: commandeId},
		include: {items: true, payments: {where: {status: 'PENDING', provider: 'STRIPE'}}},
	});

	if (!commande) return {ok: false, erreur: 'Commande introuvable.'};

	const paiement = commande.payments[0];
	if (!paiement) return {ok: false, erreur: 'Aucun paiement en attente sur cette commande.'};

	const articles = commande.items.map((ligne) => ({
		quantity: ligne.quantity,
		price_data: {
			currency: 'eur',
			unit_amount: ligne.unitPriceCents,
			product_data: {
				name: ligne.variantName
					? `${ligne.productName} — ${ligne.variantName}`
					: ligne.productName,
			},
		},
	}));

	const session = await stripe().checkout.sessions.create(
		{
			mode: 'payment',
			locale: 'fr',
			line_items: articles,
			customer_email: commande.email,
			/* Deux façons de retrouver la commande au retour du webhook. La
			   seconde survit aux événements qui ne portent pas
			   `client_reference_id`. */
			client_reference_id: commande.id,
			metadata: {commandeId: commande.id, numero: commande.orderNumber, jetonPanier},
			payment_intent_data: {
				metadata: {commandeId: commande.id, numero: commande.orderNumber},
				description: `Commande ${commande.orderNumber}`,
			},
			/* La livraison passe par `shipping_options` plutôt que par une ligne
			   d'article : elle apparaît ainsi comme frais de port sur la page de
			   paiement et sur le reçu Stripe, pas comme un produit acheté. */
			shipping_options: [
				{
					shipping_rate_data: {
						type: 'fixed_amount',
						display_name: commande.shippingMethod ?? 'Livraison',
						fixed_amount: {amount: commande.shippingCents, currency: 'eur'},
					},
				},
			],
			/* Une heure pour payer. Passé ce délai la session expire : la commande
			   reste en attente et le visiteur peut en repasser une. */
			expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
			success_url: `${origine}/commande/confirmation?paiement=succes`,
			cancel_url: `${origine}/commande/paiement?annule=1`,
		},
		/* Clé d'idempotence : un double clic ou un rejeu réseau retombe sur la
		   session déjà créée au lieu d'en ouvrir une seconde. */
		{idempotencyKey: `paiement-${paiement.id}`},
	);

	return {ok: true, url: session.url};
}

/// Vérifie la signature d'un webhook. Lève si elle ne correspond pas — un corps
/// non signé peut venir de n'importe qui et ne doit rien déclencher.
export async function lireEvenementStripe(corps, signature) {
	const secret = process.env.STRIPE_WEBHOOK_SECRET;

	if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET absente : webhook refusé.');

	return stripe().webhooks.constructEventAsync(corps, signature, secret);
}

/* Marque une commande payée.

   Appelée uniquement depuis le webhook. Trois effets, dans une seule
   transaction : le paiement passe en réussi, la commande en payée, le stock est
   décrémenté. Si l'un échoue, aucun n'est écrit — une commande payée dont le
   stock n'a pas bougé se voit trop tard. */
export async function confirmerPaiement(session) {
	const commandeId = session.client_reference_id ?? session.metadata?.commandeId;
	if (!commandeId) return {ok: false, erreur: 'Événement sans référence de commande.'};

	const commande = await prisma.order.findUnique({
		where: {id: commandeId},
		include: {items: true, payments: {where: {provider: 'STRIPE'}}},
	});

	if (!commande) return {ok: false, erreur: `Commande ${commandeId} introuvable.`};

	// Rejeu d'un événement déjà traité : on répond que tout va bien, sans rien
	// réécrire. Décrémenter le stock une seconde fois serait invisible et faux.
	if (commande.status !== 'PENDING_PAYMENT') return {ok: true, dejaTraitee: true};

	const paiement = commande.payments.find((p) => p.status === 'PENDING') ?? commande.payments[0];
	const intentId =
		typeof session.payment_intent === 'string'
			? session.payment_intent
			: (session.payment_intent?.id ?? null);

	/* Le montant encaissé doit correspondre au total facturé. En cas d'écart, on
	   enregistre le paiement mais on laisse la commande en attente avec une note
	   d'administration : c'est un cas assez anormal pour mériter un œil humain,
	   et une commande expédiée sur un montant faux se rattrape mal. */
	if (typeof session.amount_total === 'number' && session.amount_total !== commande.totalCents) {
		await prisma.$transaction([
			prisma.payment.update({
				where: {id: paiement.id},
				data: {
					status: 'SUCCEEDED',
					providerPaymentId: intentId,
					amountCents: session.amount_total,
					rawPayload: session,
				},
			}),
			prisma.order.update({
				where: {id: commande.id},
				data: {
					adminNote: `Montant encaissé (${session.amount_total} c) différent du total facturé (${commande.totalCents} c) — à vérifier avant expédition.`,
				},
			}),
		]);

		return {ok: false, erreur: 'Montant encaissé différent du total facturé.'};
	}

	await prisma.$transaction(async (tx) => {
		await tx.payment.update({
			where: {id: paiement.id},
			data: {
				status: 'SUCCEEDED',
				providerPaymentId: intentId,
				rawPayload: session,
			},
		});

		await tx.order.update({
			where: {id: commande.id},
			data: {status: 'PAID', paidAt: new Date()},
		});

		/* Le stock ne bouge qu'ici : réserver dès la mise au panier bloquerait des
		   pièces pour des paniers abandonnés. Les ouvrages numériques n'ont pas de
		   stock à décrémenter.

		   Le compteur peut passer sous zéro si deux clients ont payé la dernière
		   pièce à quelques secondes d'intervalle. C'est volontaire : un stock
		   négatif est visible en administration et se règle avec le client, alors
		   qu'un stock bloqué à zéro effacerait la trace de la survente. */
		for (const ligne of commande.items) {
			if (!ligne.variantId || ligne.kind === 'DIGITAL') continue;

			await tx.productVariant.update({
				where: {id: ligne.variantId},
				data: {stock: {decrement: ligne.quantity}},
			});
		}

		/* Le panier n'est vidé qu'au paiement confirmé : si le visiteur abandonne
		   sur la page Stripe, il retrouve ses articles au lieu d'un panier vide et
		   d'une commande impayée. */
		const jeton = session.metadata?.jetonPanier;
		if (jeton) await tx.cartItem.deleteMany({where: {cart: {sessionToken: jeton}}});
	});

	/* L'e-mail part après la transaction, jamais dedans : un envoi lent
	   tiendrait la transaction ouverte, et un envoi raté annulerait
	   l'encaissement. `envoyerConfirmationCommande` ne lève pas — au pire, le
	   message manque et la commande, elle, est bien enregistrée. */
	await envoyerConfirmationCommande(commande);

	return {ok: true};
}

/// Enregistre un paiement qui n'a pas abouti (refus bancaire, session expirée).
/// La commande reste en attente : le visiteur peut retenter.
export async function echecPaiement(session, raison) {
	const commandeId = session.client_reference_id ?? session.metadata?.commandeId;
	if (!commandeId) return {ok: false, erreur: 'Événement sans référence de commande.'};

	await prisma.payment.updateMany({
		where: {orderId: commandeId, provider: 'STRIPE', status: 'PENDING'},
		data: {status: 'FAILED', failureReason: raison, rawPayload: session},
	});

	return {ok: true};
}

/* Enregistre un remboursement.

   Retrouvé par l'identifiant Stripe du paiement, seul lien disponible sur cet
   événement — c'est pour cela que `confirmerPaiement` prend soin de stocker le
   `payment_intent` plutôt que l'identifiant de la session. */
export async function enregistrerRemboursement(charge) {
	const intentId =
		typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;

	if (!intentId) return {ok: false, erreur: 'Remboursement sans paiement rattaché.'};

	const paiement = await prisma.payment.findUnique({where: {providerPaymentId: intentId}});
	if (!paiement) return {ok: false, erreur: `Paiement ${intentId} inconnu.`};

	const rembourseCents = charge.amount_refunded ?? 0;
	const total = rembourseCents >= paiement.amountCents;

	await prisma.$transaction([
		prisma.payment.update({
			where: {id: paiement.id},
			data: {
				refundedCents: rembourseCents,
				status: total ? 'REFUNDED' : paiement.status,
				rawPayload: charge,
			},
		}),
		/* Seul un remboursement intégral change le statut de la commande : un
		   remboursement partiel (un article manquant, un geste commercial) laisse
		   la commande payée et expédiable. */
		...(total
			? [prisma.order.update({where: {id: paiement.orderId}, data: {status: 'REFUNDED'}})]
			: []),
	]);

	return {ok: true};
}
