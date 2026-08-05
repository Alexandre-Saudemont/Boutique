import 'server-only';
import {verifierLimite} from '@/server/auth/rate-limit';
import {envoyerMessageContact} from '@/server/email/messages';
import {emailValide} from '@/server/services/newsletter';
import {getSettings} from '@/server/services/settings';

/* Le formulaire de contact.

   Le message part par e-mail et n'est pas conservé en base. C'est une limite
   assumée : si l'envoi échoue, le message est perdu et le visiteur en est
   averti tout de suite, plutôt que rassuré à tort. Le jour où le volume le
   justifiera, une boîte de réception dans le back-office sera le bon ajout —
   pas un stockage silencieux dont personne ne regarde le contenu. */

/* Les sujets proposés, et rien d'autre.

   La liste est fermée côté serveur : un `<select>` ne protège de rien, son
   contenu se réécrit dans le navigateur. Sans cette vérification, n'importe qui
   choisirait la ligne d'objet des e-mails qui arrivent chez le client. */
export const SUJETS = [
	'Une question sur une commande',
	'Une question sur un article',
	'Une recherche particulière',
	'Une proposition de vente ou d’échange',
	'Autre chose',
];

const LONGUEUR_MAX = {nom: 80, sujet: 120, message: 4000};

/* Combien de messages depuis une même adresse, et sur quelle durée.

   Trois par quart d'heure : de quoi se reprendre après une faute de frappe,
   pas de quoi se servir du formulaire comme d'un canon à spam. */
const LIMITE = {max: 3, fenetreMs: 15 * 60 * 1000};

/* Envoie un message de contact.

   Retourne `{ok}` ou `{ok: false, erreur}` — jamais d'exception : l'appelant
   est une action de formulaire, qui doit pouvoir réafficher la saisie. */
export async function envoyerDemandeContact({nom, email, sujet, message, piege}) {
	/* Le champ-piège est invisible à l'écran et vide chez un humain. Un robot
	   qui remplit tout ce qu'il trouve se dénonce en le remplissant. On répond
	   alors « c'est envoyé » sans rien envoyer : lui dire qu'il a été repéré
	   reviendrait à lui expliquer comment passer la prochaine fois. */
	if (String(piege ?? '').trim()) return {ok: true};

	const nomPropre = String(nom ?? '').trim();
	const adresse = String(email ?? '')
		.trim()
		.toLowerCase();
	const sujetPropre = String(sujet ?? '').trim();
	const messagePropre = String(message ?? '').trim();

	if (nomPropre.length < 2 || nomPropre.length > LONGUEUR_MAX.nom) {
		return {ok: false, erreur: 'Indiquez le nom sous lequel vous souhaitez que je vous réponde.'};
	}

	if (!emailValide(adresse)) {
		return {ok: false, erreur: 'Cette adresse e-mail ne semble pas valide.'};
	}

	if (!SUJETS.includes(sujetPropre)) {
		return {ok: false, erreur: 'Choisissez un sujet dans la liste.'};
	}

	if (messagePropre.length < 10) {
		return {ok: false, erreur: 'Votre message est un peu court — dites-m’en un peu plus.'};
	}

	if (messagePropre.length > LONGUEUR_MAX.message) {
		return {ok: false, erreur: 'Votre message dépasse 4 000 caractères. Faites au plus court.'};
	}

	const limite = verifierLimite(`contact:${adresse}`, LIMITE);

	if (!limite.autorise) {
		const minutes = Math.ceil(limite.resteSecondes / 60);

		return {
			ok: false,
			erreur: `Vous venez déjà d’écrire. Laissez-moi le temps de lire — réessayez dans ${minutes} minute${
				minutes > 1 ? 's' : ''
			}.`,
		};
	}

	const reglages = await getSettings();

	/* Où arrive le message. L'adresse publiée dans les mentions légales
	   d'abord ; à défaut, l'adresse d'expédition du site, qui existe toujours
	   dès que l'envoi est configuré. Sans ni l'une ni l'autre, il n'y a pas de
	   boîte où déposer quoi que ce soit : autant le dire. */
	const destinataire = String(reglages['legal.email'] ?? '').trim() || process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM;

	if (!destinataire) {
		return {
			ok: false,
			erreur: 'Le formulaire n’est pas encore relié à une boîte mail. Réessayez un peu plus tard.',
		};
	}

	const envoi = await envoyerMessageContact({
		destinataire,
		nom: nomPropre,
		email: adresse,
		sujet: sujetPropre,
		message: messagePropre,
	});

	if (!envoi.ok) {
		return {
			ok: false,
			erreur: 'Votre message n’a pas pu partir. Réessayez dans un moment, ou écrivez-moi directement.',
		};
	}

	return {ok: true};
}
