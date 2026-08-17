import 'server-only';

/* L'envoi d'e-mails.

   Une seule porte de sortie pour tout le projet : le reste du code appelle
   `envoyerEmail` et ne sait pas par où ça part. Changer de prestataire ne
   touchera que ce fichier.

   **Sans clé, rien ne part et rien ne casse.** L'e-mail est écrit dans la
   console et la fonction répond « pas envoyé ». C'est ce qui permet de
   travailler sur le tunnel de commande sans compte d'envoi — et surtout, ça
   évite qu'une commande payée échoue parce que le serveur de mail est
   injoignable. Un e-mail manquant se renvoie ; une commande perdue, non.

   Le prestataire retenu est Resend, appelé par son API HTTP plutôt que par son
   SDK : une requête `fetch` de quinze lignes contre une dépendance de plus à
   suivre et à mettre à jour. */

const URL_RESEND = 'https://api.resend.com/emails';

export function envoiConfigure() {
	return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/* Envoie un e-mail. Ne lève jamais.

   Le choix est délibéré : cette fonction est appelée depuis le webhook de
   paiement et depuis les actions du back-office, où une exception ferait
   échouer une opération autrement réussie. L'échec est journalisé et remonté
   dans la valeur de retour, à charge de l'appelant d'en faire ce qu'il veut. */
export async function envoyerEmail({destinataire, sujet, texte, html}) {
	if (!envoiConfigure()) {
		console.info(
			`[email] non configuré — non envoyé à ${destinataire}\n  Sujet : ${sujet}\n${texte}`,
		);

		return {ok: false, raison: 'non-configuré'};
	}

	try {
		const reponse = await fetch(URL_RESEND, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: process.env.EMAIL_FROM,
				to: [destinataire],
				subject: sujet,
				text: texte,
				html,
				...(process.env.EMAIL_REPLY_TO ? {reply_to: process.env.EMAIL_REPLY_TO} : {}),
			}),
		});

		if (!reponse.ok) {
			const detail = await reponse.text();
			console.error(`[email] refusé par le prestataire (${reponse.status}) : ${detail}`);

			return {ok: false, raison: 'refusé'};
		}

		return {ok: true};
	} catch (erreur) {
		// Réseau coupé, DNS, délai dépassé : on note et on continue.
		console.error('[email] envoi impossible :', erreur);

		return {ok: false, raison: 'injoignable'};
	}
}
