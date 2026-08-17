'use server';

import {redirect} from 'next/navigation';
import {headers} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {creerCommande, validerAdresse} from '@/server/services/checkout';
import {getCart} from '@/server/services/cart';
import {creerSessionPaiement, paiementEnLigneActif} from '@/server/services/payments';
import {getSettings} from '@/server/services/settings';
import {getCartToken} from '@/server/auth/cart-session';
import {getUtilisateurCourant} from '@/server/auth/session';
import {getBrouillonCommande, setBrouillonCommande} from '@/server/auth/checkout-session';
import {verifierLimite} from '@/server/auth/rate-limit';
import {effacerCodePromo, getCodePromo} from '@/server/auth/promo-session';

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

	/* Relu du panier en base, pas du formulaire : le formulaire masque les champs
	   d'adresse quand tout est dématérialisé, mais un envoi forgé pourrait
	   prétendre l'être pour éviter les frais de port. */
	const panier = await getCart(await getCartToken(), await getCodePromo());
	const {dematerialise} = panier;

	const controle = validerAdresse(adresse, {dematerialise});

	if (!controle.valide) {
		return {statut: 'erreur', erreurs: controle.erreurs, adresse, rateId};
	}

	if (!dematerialise && !rateId) {
		return {
			statut: 'erreur',
			erreurs: {rateId: 'Choisissez un mode de livraison.'},
			adresse,
			rateId,
		};
	}

	await setBrouillonCommande({
		adresse,
		rateId: dematerialise ? null : rateId,
		note: donnees.get('note') || null,
		/* Le choix d'être livré en deux fois. Recueilli ici et pas plus tard :
		   c'est à l'étape livraison que le client voit ce que le second colis lui
		   coûte, donc le seul endroit où la question a du sens.

		   La valeur n'est pas crue sur parole — `creerCommande` la confronte au
		   panier relu en base et l'ignore si celui-ci ne s'y prête pas. */
		livraisonScindee: donnees.get('livraison') === 'deux-colis',
	});

	redirect('/commande/paiement');
}

/* L'adresse publique du site, telle que le navigateur l'a demandée.

   Stripe a besoin d'URL absolues pour ramener le visiteur. On les déduit des
   en-têtes de la requête plutôt que de les coder en dur : le site tourne en
   local, en préproduction et en production sans qu'on y touche. La variable
   d'environnement prime quand elle existe — derrière un proxy, `host` peut être
   celui du conteneur et non le domaine public. */
async function origineDuSite() {
	if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

	const entetes = await headers();
	const hote = entetes.get('x-forwarded-host') ?? entetes.get('host');
	const protocole = entetes.get('x-forwarded-proto') ?? 'http';

	return `${protocole}://${hote}`;
}

/* Étape 3 : crée la commande, puis envoie payer.

   Deux chemins, selon que les clés Stripe sont renseignées ou non.

   Avec les clés : la commande est créée en attente, une session de paiement
   s'ouvre et le visiteur part sur la page hébergée par Stripe. Rien d'autre
   n'est marqué ici — c'est le webhook qui passera la commande en payée.

   Sans les clés : le comportement d'avant, la commande est enregistrée et le
   règlement se fait à la main. C'est ce qui permet de travailler sur le tunnel
   sans compte Stripe, et ça reste vrai en production tant que les clés
   manquent : mieux vaut une commande à rappeler qu'un bouton qui échoue. */
export async function payerCommande(_precedent, donnees) {
	const jeton = await getCartToken();
	const brouillon = await getBrouillonCommande();

	if (!brouillon) {
		return {
			statut: 'erreur',
			message: 'Vos informations de livraison ont expiré. Reprenez à l’étape précédente.',
		};
	}

	/* Une commande créée est une ligne en base et une session de paiement chez
	   Stripe. Rejouer l'action en boucle remplirait la table de commandes
	   fantômes et consommerait le quota d'API. La limite porte sur le panier —
	   c'est le seul identifiant stable d'un visiteur non connecté. */
	const limite = verifierLimite(`commande:${jeton}`, {max: 10, fenetreMs: 10 * 60 * 1000});

	if (!limite.autorise) {
		return {
			statut: 'erreur',
			message: 'Trop de tentatives de paiement. Reprenez dans quelques minutes.',
		};
	}

	/* Le moyen demandé, revérifié contre le réglage.

	   Le formulaire n'affiche PayPal que s'il est activé, mais un champ de
	   formulaire se réécrit dans le navigateur : sans ce contrôle, n'importe qui
	   demanderait une session PayPal alors que le moyen n'est pas activé chez
	   Stripe, et récolterait une erreur de création juste après avoir cliqué
	   « payer ». On retombe silencieusement sur la carte — le moyen qui, lui,
	   fonctionne toujours. */
	const reglages = await getSettings();
	const moyen =
		donnees.get('provider') === 'paypal' && reglages['payment.paypalEnabled'] ? 'paypal' : 'carte';

	const enLigne = paiementEnLigneActif();

	/* Le compte, s'il y en a un : c'est ce qui rattache la commande à l'espace
	   client. La session est lue ici et pas dans le service — un service ne
	   connaît pas les cookies. */
	const utilisateur = await getUtilisateurCourant();

	const resultat = await creerCommande({
		token: jeton,
		adresse: brouillon.adresse,
		rateId: brouillon.rateId,
		note: brouillon.note,
		provider: 'STRIPE',
		viderPanier: !enLigne,
		codePromo: await getCodePromo(),
		userId: utilisateur?.id ?? null,
		livraisonScindee: Boolean(brouillon.livraisonScindee),
	});

	if (!resultat.ok) {
		return {statut: 'erreur', message: resultat.erreur};
	}

	/* Le code a été consommé par la commande : on le retire du navigateur pour
	   qu'il ne se réapplique pas au panier suivant. Il reste copié sur la
	   commande, qui garde la trace de ce qui a été accordé. */
	await effacerCodePromo();

	let urlPaiement = null;

	if (enLigne) {
		const session = await creerSessionPaiement({
			commandeId: resultat.id,
			jetonPanier: jeton,
			origine: await origineDuSite(),
			moyen,
		});

		if (!session.ok) {
			/* La commande existe, le paiement n'a pas pu s'ouvrir. On le dit sans
			   détour plutôt que de laisser croire à un achat abouti — la commande
			   porte déjà son numéro et se retrouvera en administration. */
			return {
				statut: 'erreur',
				message: `Votre commande ${resultat.numero} est enregistrée, mais la page de paiement n’a pas pu s’ouvrir. Réessayez dans un instant.`,
			};
		}

		urlPaiement = session.url;
	}

	/* La référence de la commande rejoint le brouillon : c'est ce qui permet à
	   l'écran de confirmation de la retrouver sans faire passer le numéro et
	   l'e-mail par l'URL.

	   Quand un paiement en ligne suit, l'adresse et le mode de livraison restent
	   dans le cookie : le visiteur qui renonce sur la page Stripe revient à
	   l'étape paiement avec ses informations, pas devant un formulaire vide. */
	await setBrouillonCommande(
		enLigne
			? {...brouillon, commande: {numero: resultat.numero, email: brouillon.adresse.email}}
			: {commande: {numero: resultat.numero, email: brouillon.adresse.email}},
	);

	revalidatePath('/', 'layout');

	// `redirect` lève : rien ne doit s'exécuter après, et l'appel reste hors du
	// try/catch de la création de session pour ne pas être avalé.
	redirect(urlPaiement ?? '/commande/confirmation');
}
