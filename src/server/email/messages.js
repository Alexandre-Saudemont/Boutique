import 'server-only';
import {envoyerEmail} from '@/server/email/transport';
import {formatPrix} from '@/lib/format';

/* Les e-mails que le site envoie.

   Deux pour l'instant, les deux seuls que le client attend vraiment : « c'est
   bien passé » et « c'est parti ». Le ton est celui du site — le Vieux geek
   parle à la première personne.

   Chaque message part en texte **et** en HTML. Le texte n'est pas un repli
   négligeable : c'est ce que lisent certains clients de messagerie, et un
   message qui n'a qu'une version HTML est plus souvent classé en indésirable. */

/* Échappe ce qui va dans le HTML.

   Un nom de client, un intitulé de produit : tout cela vient d'une saisie et
   peut contenir `<` ou `&`. Sans échappement, une commande au nom de
   `<script>` casserait le message — et un e-mail est une page HTML comme une
   autre, affichée chez quelqu'un d'autre. */
function echapper(valeur) {
	return String(valeur ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/* Une coquille HTML minimale.

   Styles en attributs `style` et non dans une feuille : les clients de
   messagerie retirent les `<style>`, quand ils ne suppriment pas tout le
   `<head>`. Ce qui n'est pas en ligne n'est pas appliqué. */
function coquille(titre, corps) {
	return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f7f3ec;font-family:Georgia,serif;color:#2e2b25;">
<div style="max-width:560px;margin:0 auto;background:#fffdf9;border-radius:16px;padding:28px;">
<h1 style="font-size:22px;margin:0 0 18px;">${echapper(titre)}</h1>
${corps}
<p style="font-size:13px;color:#6b6459;margin-top:28px;">L'antre du vieux geek fou</p>
</div></body></html>`;
}

/// Le tableau des articles, commun aux deux messages.
function lignesArticles(commande) {
	return commande.items
		.map(
			(ligne) =>
				`<tr><td style="padding:6px 0;">${echapper(ligne.productName)}${
					ligne.variantName && ligne.variantName !== 'Standard'
						? ` — ${echapper(ligne.variantName)}`
						: ''
				} × ${ligne.quantity}</td><td style="padding:6px 0;text-align:right;">${formatPrix(
					ligne.totalCents,
				)}</td></tr>`,
		)
		.join('');
}

function articlesEnTexte(commande) {
	return commande.items
		.map(
			(ligne) =>
				`- ${ligne.productName}${
					ligne.variantName && ligne.variantName !== 'Standard' ? ` — ${ligne.variantName}` : ''
				} × ${ligne.quantity} : ${formatPrix(ligne.totalCents)}`,
		)
		.join('\n');
}

/* Confirmation de commande, envoyée quand le paiement est confirmé — jamais
   avant. Un « merci pour votre commande » envoyé sur un paiement qui échoue
   ensuite oblige à écrire un second message pour se dédire. */
export async function envoyerConfirmationCommande(commande) {
	const sujet = `Votre commande ${commande.orderNumber} est confirmée`;

	const texte = `Merci !

Votre paiement est bien arrivé, votre commande ${commande.orderNumber} est confirmée.

${articlesEnTexte(commande)}

Livraison : ${commande.shippingCents === 0 ? 'offerte' : formatPrix(commande.shippingCents)}
Total : ${formatPrix(commande.totalCents)}

Je prépare votre colis et je vous préviens dès qu'il part.

Le Vieux geek`;

	const html = coquille(
		'Merci — votre commande est confirmée',
		`<p style="font-size:15px;line-height:1.6;">Votre paiement est bien arrivé. Votre commande <strong>${echapper(
			commande.orderNumber,
		)}</strong> est confirmée.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;">${lignesArticles(commande)}
<tr><td style="padding:6px 0;border-top:1px solid #e6ded1;">Livraison</td><td style="padding:6px 0;text-align:right;border-top:1px solid #e6ded1;">${
			commande.shippingCents === 0 ? 'Offerte' : formatPrix(commande.shippingCents)
		}</td></tr>
<tr><td style="padding:6px 0;font-weight:bold;">Total</td><td style="padding:6px 0;text-align:right;font-weight:bold;">${formatPrix(
			commande.totalCents,
		)}</td></tr></table>
<p style="font-size:15px;line-height:1.6;">Je prépare votre colis et je vous préviens dès qu'il part.</p>`,
	);

	return envoyerEmail({destinataire: commande.email, sujet, texte, html});
}

/// Avis d'expédition, avec le suivi s'il a été saisi.
export async function envoyerAvisExpedition(commande) {
	const sujet = `Votre commande ${commande.orderNumber} est en route`;

	const suivi = commande.trackingNumber
		? `\n\nSuivi ${commande.carrier ?? ''} : ${commande.trackingNumber}`
		: '';

	const texte = `Bonne nouvelle : votre colis est parti.

Commande ${commande.orderNumber}${suivi}

À bientôt dans l'antre,
Le Vieux geek`;

	const html = coquille(
		'Votre colis est parti',
		`<p style="font-size:15px;line-height:1.6;">Votre commande <strong>${echapper(
			commande.orderNumber,
		)}</strong> vient de quitter l'atelier.</p>
${
	commande.trackingNumber
		? `<p style="font-size:15px;line-height:1.6;">Suivi ${echapper(
				commande.carrier ?? '',
			)} : <strong>${echapper(commande.trackingNumber)}</strong></p>`
		: ''
}
<p style="font-size:15px;line-height:1.6;">À bientôt dans l'antre.</p>`,
	);

	return envoyerEmail({destinataire: commande.email, sujet, texte, html});
}
