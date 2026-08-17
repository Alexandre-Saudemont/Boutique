import 'server-only';
import {envoyerEmail} from '@/server/email/transport';
import {formatPrix} from '@/lib/format';
import {adresseDuSite} from '@/lib/site-url';

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

/* Les couleurs, reprises de `src/styles/organic.css`.

   En valeurs littérales et non en `var(--…)` : Outlook rend le HTML avec le
   moteur de Word, qui ne connaît pas les variables CSS. Une couleur écrite en
   variable n'y serait tout simplement pas appliquée, et le texte tomberait sur
   le noir par défaut — sur un fond qui, lui, serait resté crème.

   `ACCENT` est `--color-accent-600` et non l'accent brut : le blanc sur
   l'accent ne passe pas le contraste. Même règle que sur le site, où le texte
   en terracotta monte à `--color-accent-700`. */
const T = {
	fond: '#f5ead8', // --color-bg
	carte: '#f9f4ed', // --color-neutral-100
	blanc: '#ffffff',
	titre: '#201e1d', // --color-text
	texte: '#474238', // --color-neutral-800
	discret: '#82796a', // --color-neutral-600
	trait: '#eee7db', // --color-neutral-200
	traitFort: '#dcd3c4', // --color-neutral-300
	accent: '#b2622d', // --color-accent-600 — fonds et boutons
	accentTexte: '#8c491a', // --color-accent-700 — liens et montants
	accentClair: '#ffe1d0', // --color-accent-200
	sauge: '#728157', // --color-accent-2-600
	saugeFonce: '#56633f', // --color-accent-2-700
	saugeClair: '#e1eecc', // --color-accent-2-200
	sombre: '#474238',
};

/* Deux piles de polices, et un renoncement assumé.

   Caprasimo et Figtree ne s'afficheront jamais : Outlook et Gmail ignorent
   `@font-face`. Georgia gras est la substitution la plus proche de l'esprit
   Caprasimo parmi les polices installées partout — chaleureuse, à empattements,
   un peu massive. C'est le seul écart visible avec le site, et la seule
   alternative serait une image, bloquée par défaut chez la plupart des
   destinataires. */
const POLICE_TITRE = "Georgia,'Times New Roman',serif";
const POLICE_TEXTE = 'Helvetica,Arial,sans-serif';

/* Les trois habillages d'en-tête.

   La lettre passe en sauge et non en terracotta : un e-mail commercial et une
   confirmation de commande ne doivent pas se ressembler, sans quoi le client
   qui se désabonne de l'un croit se couper de l'autre. Le message de contact,
   lui, part vers l'intérieur — inutile de lui servir la devanture. */
const HABILLAGES = {
	boutique: {bandeau: T.accent, surtitre: 'L’antre du', titre: 'vieux geek fou', clair: T.accentClair},
	lettre: {bandeau: T.sauge, surtitre: 'La lettre de', titre: 'l’antre', clair: T.saugeClair},
	interne: {bandeau: T.sombre, surtitre: null, titre: 'Message reçu sur le site', clair: T.traitFort},
};

/* Un bouton qui survit à Outlook.

   Un `<a>` stylé en `display:inline-block` perd son fond sous le moteur de
   Word : seul le texte reste cliquable, sur fond blanc. La cellule de tableau
   porte donc la couleur, et le lien ne porte que sa propre zone de clic. */
export function bouton(lien, libelle, {couleur = T.accent} = {}) {
	return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 6px;"><tr><td style="background:${couleur};border-radius:999px;">
<a href="${echapper(lien)}" style="display:inline-block;padding:13px 28px;font-family:${POLICE_TEXTE};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${echapper(libelle)}</a>
</td></tr></table>`;
}

/// Un paragraphe courant.
function p(contenu, {taille = 15, couleur = T.texte, marge = '0 0 16px'} = {}) {
	return `<p style="font-family:${POLICE_TEXTE};font-size:${taille}px;line-height:1.65;margin:${marge};color:${couleur};">${contenu}</p>`;
}

/// Une mention discrète — durée de validité, « ce n'était pas vous », etc.
function mention(contenu) {
	return p(contenu, {taille: 13, couleur: T.discret, marge: '18px 0 0'});
}

/* La coquille : bandeau, carte, pied.

   Styles en attributs `style` et non dans une feuille : les clients de
   messagerie retirent les `<style>`, quand ils ne suppriment pas tout le
   `<head>`. Ce qui n'est pas en ligne n'est pas appliqué. Mise en page en
   tableaux imbriqués pour la même raison — ni flexbox ni grille ne sont
   comprises par le moteur de Word.

   `color-scheme` demande aux clients de ne pas inverser les couleurs en mode
   sombre. Gmail et Apple Mail le respectent en partie seulement : d'où des
   fonds déclarés explicitement à chaque niveau, pour qu'un fond retourné ne
   laisse jamais du texte clair sur clair.

   `preheader` est le texte d'aperçu affiché dans la liste des messages, juste
   après l'objet. Sans lui, le client de messagerie y recopie le premier texte
   trouvé — souvent « L'antre du vieux geek fou » du bandeau, ce qui n'apprend
   rien. */
function coquille(titre, corps, {jetonDesinscription = null, variante = 'boutique', preheader = ''} = {}) {
	const habillage = HABILLAGES[variante] ?? HABILLAGES.boutique;

	/* Le lien de désinscription n'apparaît que sur les messages de la lettre.

	   Il n'a rien à faire sur une confirmation de commande : un e-mail
	   transactionnel n'est pas de la prospection, et proposer de s'en désinscrire
	   ferait croire au client qu'il peut refuser d'être prévenu de l'expédition
	   de son colis. */
	const desinscription = jetonDesinscription
		? `<br><a href="${adresseDuSite()}/newsletter/desinscription?jeton=${encodeURIComponent(
				jetonDesinscription,
			)}" style="color:${T.discret};">Se désinscrire de la lettre</a>`
		: '';

	const pied =
		variante === 'interne'
			? ''
			: `<tr><td style="padding:18px 28px 4px;text-align:center;font-family:${POLICE_TEXTE};font-size:12px;line-height:1.7;color:${T.discret};">
L’antre du vieux geek fou · boutique indépendante de pop culture<br>
<a href="${adresseDuSite()}/contact" style="color:${T.accentTexte};">Nous écrire</a> &nbsp;·&nbsp; <a href="${adresseDuSite()}/legal" style="color:${T.accentTexte};">Mentions légales</a>${desinscription}
</td></tr>`;

	const enTete = habillage.surtitre
		? `<div style="font-family:${POLICE_TITRE};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${habillage.clair};">${habillage.surtitre}</div>
<div style="font-family:${POLICE_TITRE};font-weight:bold;font-size:25px;color:#ffffff;line-height:1.15;margin-top:3px;">${habillage.titre}</div>`
		: `<div style="font-family:${POLICE_TITRE};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${habillage.clair};">${habillage.titre}</div>`;

	return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${echapper(titre)}</title></head>
<body style="margin:0;padding:0;background:${T.fond};">
<div style="display:none;font-size:1px;color:${T.fond};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${echapper(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.fond};"><tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="background:${habillage.bandeau};border-radius:16px 16px 0 0;padding:${
		variante === 'interne' ? '14px 28px' : '22px 28px'
	};text-align:center;">
${enTete}
</td></tr>
<tr><td style="background:${T.carte};border-radius:0 0 16px 16px;padding:30px 28px;">
<h1 style="font-family:${POLICE_TITRE};font-size:23px;line-height:1.2;margin:0 0 10px;color:${T.titre};">${echapper(titre)}</h1>
${corps}
</td></tr>
${pied}
</table>
</td></tr></table>
</body></html>`;
}

/// Le tableau des articles, commun à la confirmation et à l'expédition.
function lignesArticles(commande) {
	return commande.items
		.map(
			(ligne, index) =>
				`<tr><td style="padding:${index === 0 ? '14px 16px 8px' : '8px 16px'};${
					index === 0 ? '' : `border-top:1px solid ${T.trait};`
				}font-family:${POLICE_TEXTE};font-size:14px;color:${T.texte};">${echapper(ligne.productName)}${
					ligne.variantName && ligne.variantName !== 'Standard'
						? ` — ${echapper(ligne.variantName)}`
						: ''
				} <span style="color:${T.discret};">× ${ligne.quantity}</span></td><td align="right" style="padding:${
					index === 0 ? '14px 16px 8px' : '8px 16px'
				};${
					index === 0 ? '' : `border-top:1px solid ${T.trait};`
				}font-family:${POLICE_TEXTE};font-size:14px;color:${T.texte};white-space:nowrap;">${formatPrix(
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
		'Merci — c’est noté.',
		`${p(
			`Votre paiement est bien arrivé. Votre commande <strong style="color:${T.titre};">${echapper(
				commande.orderNumber,
			)}</strong> est confirmée.`,
			{marge: '0 0 20px'},
		)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.blanc};border-radius:10px;">${lignesArticles(commande)}
<tr><td style="padding:8px 16px;border-top:1px solid ${T.trait};font-family:${POLICE_TEXTE};font-size:14px;color:${T.texte};">Livraison</td><td align="right" style="padding:8px 16px;border-top:1px solid ${T.trait};font-family:${POLICE_TEXTE};font-size:14px;color:${T.texte};white-space:nowrap;">${
			commande.shippingCents === 0 ? 'Offerte' : formatPrix(commande.shippingCents)
		}</td></tr>
<tr><td style="padding:10px 16px 14px;border-top:2px solid ${T.traitFort};font-family:${POLICE_TEXTE};font-size:14px;font-weight:bold;color:${T.titre};">Total</td><td align="right" style="padding:10px 16px 14px;border-top:2px solid ${T.traitFort};font-family:${POLICE_TEXTE};font-size:14px;font-weight:bold;color:${T.accentTexte};white-space:nowrap;">${formatPrix(
			commande.totalCents,
		)}</td></tr></table>
${
	aDesFichiers
		? `${p('<strong>À télécharger</strong>', {marge: '24px 0 8px'})}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.blanc};border-radius:10px;">${liensTelechargement
				.map(
					(lien, index) =>
						`<tr><td style="padding:12px 16px;${
							index === 0 ? '' : `border-top:1px solid ${T.trait};`
						}font-family:${POLICE_TEXTE};font-size:14px;"><a href="${lienDe(lien)}" style="color:${T.accentTexte};">${echapper(lien.fileName)}</a></td></tr>`,
				)
				.join('')}</table>
${mention('Ces liens sont valables trente jours et cinq téléchargements. Passé ce délai, vos fichiers restent disponibles depuis votre compte, sans limite.')}`
		: bouton(`${adresseDuSite()}/compte`, 'Suivre ma commande')
}
${p(echapper(suite), {marge: '18px 0 0'})}`,
		{preheader: `Commande ${commande.orderNumber} — ${formatPrix(commande.totalCents)}`},
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
		'Presque inscrit.',
		`${p("Quelqu'un — vous, j'espère — a inscrit cette adresse à la lettre de l'antre. Un clic et vous recevrez les nouveautés, les box du mois et les trouvailles.")}
${bouton(lien, 'Je confirme mon inscription', {couleur: T.saugeFonce})}
${mention("Si ce n'était pas vous, ignorez ce message : sans confirmation, aucune lettre ne partira.")}`,
		{
			variante: 'lettre',
			jetonDesinscription: abonne.token,
			preheader: 'Un clic pour confirmer, et la lettre arrive.',
		},
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
		'On repart de zéro.',
		`${p('Vous avez demandé à changer le mot de passe de votre compte. Choisissez-en un nouveau — le lien expire dans une heure.')}
${bouton(lien, 'Changer mon mot de passe')}
${mention("Si ce n'était pas vous, ignorez ce message : votre mot de passe actuel reste valable et personne n'a accès à votre compte.")}`,
		{preheader: 'Lien valable une heure.'},
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
		'Une dernière chose.',
		`${p("Confirmez votre adresse et votre compte est prêt — c'est elle qui servira pour le suivi de vos commandes. Le lien est valable vingt-quatre heures.")}
${bouton(lien, 'Confirmer mon adresse')}
${mention("Vous n'avez rien demandé ? Ignorez ce message, aucun compte ne sera créé.")}`,
		{preheader: 'Un clic et votre compte est prêt.'},
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
		'C’est parti.',
		`${p(
			`Votre commande <strong style="color:${T.titre};">${echapper(
				commande.orderNumber,
			)}</strong> vient de quitter l'atelier.`,
			{marge: '0 0 18px'},
		)}
${
	commande.trackingNumber
		? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.saugeClair};border-radius:10px;">
<tr><td style="padding:14px 16px;font-family:${POLICE_TEXTE};font-size:13px;color:${T.saugeFonce};">
Numéro de suivi${commande.carrier ? ` · ${echapper(commande.carrier)}` : ''}<br><strong style="font-size:16px;letter-spacing:.5px;">${echapper(
				commande.trackingNumber,
			)}</strong>
</td></tr></table>`
		: ''
}
${bouton(`${adresseDuSite()}/compte`, 'Voir ma commande')}
${p("À bientôt dans l'antre.", {marge: '18px 0 0'})}`,
		{
			preheader: commande.trackingNumber
				? `Suivi ${commande.trackingNumber}`
				: 'Votre colis a quitté l’atelier.',
		},
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
		`${sujet}`,
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${POLICE_TEXTE};font-size:14px;color:${T.texte};">
<tr><td style="padding:0 0 6px;color:${T.discret};width:70px;">De</td><td style="padding:0 0 6px;">${echapper(nom)}</td></tr>
<tr><td style="padding:0 0 14px;color:${T.discret};">Adresse</td><td style="padding:0 0 14px;"><a href="mailto:${echapper(
			email,
		)}" style="color:${T.accentTexte};">${echapper(email)}</a></td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.blanc};border-left:3px solid ${T.traitFort};border-radius:0 8px 8px 0;">
<tr><td style="padding:14px 16px;font-family:${POLICE_TEXTE};font-size:14px;line-height:1.65;color:${T.texte};white-space:pre-wrap;">${echapper(
			message,
		)}</td></tr></table>
${mention("Pour répondre, cliquez sur l'adresse ci-dessus — répondre à ce message-ci n'irait nulle part, l'expéditeur est le site.")}`,
		{variante: 'interne', preheader: `${nom} — ${sujet}`},
	);

	return envoyerEmail({
		destinataire,
		sujet: `[Site] ${sujet} — ${nom}`,
		texte,
		html,
	});
}
