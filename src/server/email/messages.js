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
/* L'adresse publique du site, pour les liens des e-mails.

   Contrairement aux actions serveur, un e-mail n'a pas de requête sous la main
   d'où déduire le domaine : la variable d'environnement est ici la seule
   source. Le repli sur localhost n'est utile qu'en développement — en
   production, `NEXT_PUBLIC_SITE_URL` doit être renseignée, sans quoi les liens
   envoyés aux clients ne mèneraient nulle part. */
function adresseDuSite() {
	return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

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
function coquille(titre, corps, {jetonDesinscription = null} = {}) {
	/* Le lien de désinscription n'apparaît que sur les messages de la lettre.

	   Il n'a rien à faire sur une confirmation de commande : un e-mail
	   transactionnel n'est pas de la prospection, et proposer de s'en désinscrire
	   ferait croire au client qu'il peut refuser d'être prévenu de l'expédition
	   de son colis. */
	const pied = jetonDesinscription
		? `<p style="font-size:12px;color:#6b6459;margin-top:10px;"><a href="${adresseDuSite()}/newsletter/desinscription?jeton=${encodeURIComponent(
				jetonDesinscription,
			)}" style="color:#6b6459;">Se désinscrire de la lettre</a></p>`
		: '';

	return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f7f3ec;font-family:Georgia,serif;color:#2e2b25;">
<div style="max-width:560px;margin:0 auto;background:#fffdf9;border-radius:16px;padding:28px;">
<h1 style="font-size:22px;margin:0 0 18px;">${echapper(titre)}</h1>
${corps}
<p style="font-size:13px;color:#6b6459;margin-top:28px;">L'antre du vieux geek fou</p>
${pied}
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
export async function envoyerConfirmationCommande(commande, liensTelechargement = []) {
	const sujet = `Votre commande ${commande.orderNumber} est confirmée`;

	/* Une commande peut être entièrement dématérialisée : dans ce cas il n'y a
	   pas de colis à annoncer, et promettre un envoi ferait attendre le client
	   pour rien. */
	const aDesFichiers = liensTelechargement.length > 0;
	const toutEstNumerique = commande.items.every((ligne) => ligne.kind === 'DIGITAL');

	const suite = toutEstNumerique
		? 'Vos fichiers vous attendent, rien d’autre ne partira par la poste.'
		: 'Je prépare votre colis et je vous préviens dès qu’il part.';

	const lienDe = (lien) =>
		`${adresseDuSite()}/telechargement/${encodeURIComponent(lien.jeton)}`;

	const blocTexte = aDesFichiers
		? `\nÀ télécharger :\n${liensTelechargement
				.map((lien) => `- ${lien.fileName} : ${lienDe(lien)}`)
				.join('\n')}\n
Ces liens sont valables trente jours et cinq téléchargements. Passé ce délai,
vos fichiers restent disponibles depuis votre compte, sans limite.\n`
		: '';

	const texte = `Merci !

Votre paiement est bien arrivé, votre commande ${commande.orderNumber} est confirmée.

${articlesEnTexte(commande)}

Livraison : ${commande.shippingCents === 0 ? 'offerte' : formatPrix(commande.shippingCents)}
Total : ${formatPrix(commande.totalCents)}
${blocTexte}
${suite}

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
${
	aDesFichiers
		? `<p style="font-size:15px;line-height:1.6;margin-top:22px;"><strong>À télécharger</strong></p>
<ul style="font-size:15px;line-height:1.8;padding-left:18px;">${liensTelechargement
				.map(
					(lien) =>
						`<li><a href="${lienDe(lien)}" style="color:#a4502a;">${echapper(lien.fileName)}</a></li>`,
				)
				.join('')}</ul>
<p style="font-size:13px;color:#6b6459;line-height:1.6;">Ces liens sont valables trente jours et cinq téléchargements. Passé ce délai, vos fichiers restent disponibles depuis votre compte, sans limite.</p>`
		: ''
}
<p style="font-size:15px;line-height:1.6;">${echapper(suite)}</p>`,
	);

	return envoyerEmail({destinataire: commande.email, sujet, texte, html});
}

/* Confirmation d'inscription à la lettre.

   Le lien porte le jeton de l'abonné, jamais son adresse : une URL se retrouve
   dans les journaux du serveur, l'historique du navigateur et le `Referer`
   envoyé aux sites tiers. Un jeton opaque n'y apprend rien à personne. */
export async function envoyerConfirmationNewsletter(abonne) {
	const lien = `${adresseDuSite()}/newsletter/confirmation?jeton=${encodeURIComponent(abonne.token)}`;

	const texte = `Bonjour,

Quelqu'un — vous, j'espère — a inscrit cette adresse à la lettre de l'antre.

Confirmez d'un clic :
${lien}

Si ce n'était pas vous, ignorez ce message : sans confirmation, aucune lettre ne partira.

Le Vieux geek`;

	const html = coquille(
		'Confirmez votre inscription',
		`<p style="font-size:15px;line-height:1.6;">Quelqu'un — vous, j'espère — a inscrit cette adresse à la lettre de l'antre.</p>
<p style="margin:22px 0;"><a href="${echapper(
			lien,
		)}" style="display:inline-block;background:#c67139;color:#fffdf9;padding:12px 22px;border-radius:999px;font-size:15px;">Confirmer mon inscription</a></p>
<p style="font-size:13.5px;line-height:1.6;color:#6b6459;">Si ce n'était pas vous, ignorez ce message : sans confirmation, aucune lettre ne partira.</p>`,
	);

	return envoyerEmail({
		destinataire: abonne.email,
		sujet: 'Confirmez votre inscription à la lettre de l’antre',
		texte,
		html,
	});
}

/* Lien de réinitialisation de mot de passe.

   Le message dit explicitement quoi faire si la demande ne vient pas de la
   personne : ne rien faire. C'est important — recevoir ce message sans l'avoir
   demandé est inquiétant, et le silence sur ce point pousse à cliquer « pour
   voir », ce qui est exactement l'inverse de ce qu'on veut. */
export async function envoyerLienReinitialisation(utilisateur, jeton) {
	const lien = `${adresseDuSite()}/compte/nouveau-mot-de-passe?jeton=${encodeURIComponent(jeton)}`;

	const texte = `Bonjour,

Vous avez demandé à changer le mot de passe de votre compte sur L'antre du vieux geek fou.

Choisissez-en un nouveau ici (lien valable une heure) :
${lien}

Si ce n'était pas vous, ignorez ce message : votre mot de passe actuel reste valable et personne n'a accès à votre compte.

Le Vieux geek`;

	const html = coquille(
		'Changer votre mot de passe',
		`<p style="font-size:15px;line-height:1.6;">Vous avez demandé à changer le mot de passe de votre compte.</p>
<p style="margin:22px 0;"><a href="${echapper(
			lien,
		)}" style="display:inline-block;background:#c67139;color:#fffdf9;padding:12px 22px;border-radius:999px;font-size:15px;">Choisir un nouveau mot de passe</a></p>
<p style="font-size:13.5px;line-height:1.6;color:#6b6459;">Ce lien est valable une heure. Si ce n'était pas vous, ignorez ce message : votre mot de passe actuel reste valable.</p>`,
	);

	return envoyerEmail({
		destinataire: utilisateur.email,
		sujet: 'Changer votre mot de passe',
		texte,
		html,
	});
}

/// Vérification de l'adresse e-mail, envoyée à l'inscription.
export async function envoyerVerificationEmail(utilisateur, jeton) {
	const lien = `${adresseDuSite()}/compte/verification?jeton=${encodeURIComponent(jeton)}`;

	const texte = `Bienvenue dans l'antre !

Confirmez votre adresse d'un clic (lien valable 24 heures) :
${lien}

Si vous n'avez pas créé de compte chez moi, ignorez ce message.

Le Vieux geek`;

	const html = coquille(
		'Bienvenue dans l’antre',
		`<p style="font-size:15px;line-height:1.6;">Il ne reste qu'à confirmer votre adresse — c'est elle qui servira pour le suivi de vos commandes.</p>
<p style="margin:22px 0;"><a href="${echapper(
			lien,
		)}" style="display:inline-block;background:#c67139;color:#fffdf9;padding:12px 22px;border-radius:999px;font-size:15px;">Confirmer mon adresse</a></p>
<p style="font-size:13.5px;line-height:1.6;color:#6b6459;">Lien valable 24 heures. Si vous n'avez pas créé de compte chez moi, ignorez ce message.</p>`,
	);

	return envoyerEmail({
		destinataire: utilisateur.email,
		sujet: 'Confirmez votre adresse',
		texte,
		html,
	});
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

/* Un message du formulaire de contact, transmis au Vieux geek.

   Seul e-mail du projet qui parte vers l'intérieur et non vers un client. Deux
   précautions en découlent.

   L'adresse du visiteur est recopiée dans le corps du message, jamais placée en
   expéditeur : usurper le `From` ferait rejeter le message par les filtres du
   destinataire, quand ça ne mettrait pas tout le domaine en liste noire. Pour
   répondre, il suffit de copier l'adresse — et on saura toujours que le message
   vient du site.

   Le contenu est intégralement échappé. C'est une saisie publique affichée dans
   la boîte du client : n'importe qui peut y écrire du HTML. */
export async function envoyerMessageContact({destinataire, nom, email, sujet, message}) {
	const texte = `Message reçu depuis le site.

De : ${nom} <${email}>
Sujet : ${sujet}

${message}`;

	const html = coquille(
		'Un message depuis le site',
		`<p style="font-size:15px;line-height:1.6;">De : <strong>${echapper(nom)}</strong> — ${echapper(
			email,
		)}</p>
<p style="font-size:15px;line-height:1.6;">Sujet : <strong>${echapper(sujet)}</strong></p>
<div style="font-size:15px;line-height:1.6;white-space:pre-wrap;border-top:1px solid #e6ded1;padding-top:16px;margin-top:16px;">${echapper(
			message,
		)}</div>`,
	);

	return envoyerEmail({
		destinataire,
		sujet: `[Site] ${sujet} — ${nom}`,
		texte,
		html,
	});
}
