import 'server-only';
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir, stat, unlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {prisma} from '@/server/db';

/* Les ouvrages numériques.

   Le client vend des créations et des tirages en fichier. Décision prise sur la
   question 9 : **un lien immédiat après paiement, et le fichier reste disponible
   dans le compte**. Les deux ne suivent pas les mêmes règles, et c'est
   volontaire :

   | Accès | Preuve | Limites |
   | --- | --- | --- |
   | Lien reçu par e-mail | un jeton dans une URL | 30 jours, 5 téléchargements |
   | Espace client | une session, donc une identité | aucune |

   Un lien qui traîne dans une boîte mail est une clé sous le paillasson : il se
   transfère, il se retrouve dans un historique, il survit à la revente d'un
   ordinateur. Il est donc borné. Un compte, lui, est une identité — l'achat
   donne accès au fichier sans compteur, aussi longtemps que le compte existe.

   **Le fichier n'est jamais servi depuis une URL publique.** Il vit hors de
   `public/`, sous un nom tiré au hasard, et chaque octet passe par un contrôle.
   Un fichier posé dans `public/` serait accessible à qui devine son nom, pour
   toujours — et les moteurs finissent par deviner. */

/* Le dossier de stockage. Hors du projet servi, et configurable : le jour où
   les fichiers partiront sur un stockage objet, c'est la seule chose à changer
   ici (avec `lireFichier`). */
/* Le dossier de stockage, obligatoirement déclaré.

   Pas de valeur par défaut, pour deux raisons. La première est pratique : un
   défaut calculé depuis `process.cwd()` fait croire à l'outil de build que tout
   le projet peut être lu à l'exécution, et il embarque le dépôt entier dans le
   paquet déployé.

   La seconde est plus importante. Un défaut « quelque part dans le projet »
   marcherait en développement et se ferait effacer au premier redéploiement en
   production — avec les fichiers vendus dedans. Mieux vaut une erreur franche
   au premier téléversement qu'une perte silencieuse six mois plus tard. */
function dossierStockage() {
	const dossier = process.env.DIGITAL_STORAGE_DIR;

	if (!dossier) {
		throw new Error(
			'DIGITAL_STORAGE_DIR est absente : indiquez où ranger les fichiers vendus (voir .env.example).',
		);
	}

	return dossier;
}

/* Le chemin d'un fichier, vérifié.

   `fileKey` vient de la base et n'a jamais été saisi par personne, mais cette
   fonction est le seul endroit qui transforme une chaîne en chemin disque :
   c'est ici que la vérification doit vivre, pas chez les appelants. Une clé
   contenant `..\..\.env` doit échouer même si on ne voit pas comment elle
   arriverait là. */
function cheminDe(fileKey) {
	const racine = path.resolve(dossierStockage());
	const chemin = path.resolve(racine, fileKey);

	if (chemin !== path.join(racine, path.basename(chemin))) {
		throw new Error('Clé de fichier invalide.');
	}

	return chemin;
}

function empreinte(jeton) {
	return createHash('sha256').update(jeton).digest('hex');
}

/* Limites de l'accès par lien. Cinq téléchargements couvrent le cas honnête —
   un fichier repris sur le téléphone, puis sur l'ordinateur, plus les ratés —
   sans faire du lien un miroir de téléchargement public. */
const MAX_TELECHARGEMENTS = 5;
const JOURS_VALIDITE = 30;

/* Taille maximale acceptée à l'envoi. Au-delà, le téléversement passe par le
   navigateur en une seule requête et échouera plus souvent qu'il ne réussira.
   Elle doit rester alignée avec `serverActions.bodySizeLimit` de
   `next.config.mjs` : c'est la même borne, dite deux fois — ici pour l'expliquer
   au vendeur, là pour que le serveur n'avale pas l'envoi avant de la lire. */
export const TAILLE_MAX_OCTETS = 50 * 1024 * 1024;

const TYPES_ACCEPTES = new Set([
	'application/pdf',
	'application/epub+zip',
	'application/zip',
	'image/png',
	'image/jpeg',
	'text/plain',
]);

/* Enregistre un fichier et le rattache à un produit.

   Le nom d'origine est conservé en base pour être proposé au téléchargement,
   mais **il ne sert jamais de nom sur le disque** : deux clients qui envoient
   `couverture.pdf` s'écraseraient, et un nom saisi ailleurs pourrait sortir du
   dossier. Le nom réel est tiré au hasard, sans extension — rien de ce qui est
   déposé là ne doit pouvoir être pris pour un exécutable. */
export async function enregistrerFichier({productId, fileName, mimeType, contenu}) {
	if (!Buffer.isBuffer(contenu) || contenu.length === 0) {
		return {ok: false, erreur: 'Le fichier est vide.'};
	}

	if (contenu.length > TAILLE_MAX_OCTETS) {
		return {ok: false, erreur: 'Le fichier dépasse 50 Mo.'};
	}

	if (!TYPES_ACCEPTES.has(mimeType)) {
		return {ok: false, erreur: `Type de fichier non accepté (${mimeType}).`};
	}

	const produit = await prisma.product.findUnique({
		where: {id: productId},
		select: {id: true, kind: true},
	});

	if (!produit) return {ok: false, erreur: 'Produit introuvable.'};

	if (produit.kind !== 'DIGITAL') {
		return {ok: false, erreur: 'Ce produit n’est pas un ouvrage numérique.'};
	}

	const fileKey = randomBytes(16).toString('hex');

	/* Une configuration manquante est dite au vendeur, pas jetée en pleine page :
	   il n'y peut rien, mais il doit savoir que son fichier n'est pas parti. */
	try {
		await mkdir(dossierStockage(), {recursive: true});
		await writeFile(cheminDe(fileKey), contenu);
	} catch (erreur) {
		console.error('[numerique] écriture impossible :', erreur);
		return {ok: false, erreur: 'Le fichier n’a pas pu être enregistré sur le serveur.'};
	}

	/* Le fichier est écrit avant la ligne en base. Dans l'ordre inverse, un échec
	   d'écriture laisserait une ligne pointant vers rien — un téléchargement qui
	   échoue chez un client qui a payé. Ici, le pire est un fichier orphelin sur
	   le disque, que personne ne voit. */
	const asset = await prisma.digitalAsset.create({
		data: {
			productId,
			fileKey,
			fileName: String(fileName).slice(0, 255),
			mimeType,
			sizeBytes: contenu.length,
		},
	});

	return {ok: true, asset};
}

/* Retire un fichier.

   Refusé dès qu'un droit de téléchargement existe : on a promis au client un
   accès à vie depuis son compte, et une ligne supprimée ici le lui retirerait
   sans que personne ne s'en aperçoive. Remplacer un fichier par une nouvelle
   version se fait en ajoutant, pas en supprimant. */
export async function supprimerFichier(assetId) {
	const asset = await prisma.digitalAsset.findUnique({
		where: {id: assetId},
		include: {_count: {select: {grants: true}}},
	});

	if (!asset) return {ok: false, erreur: 'Fichier introuvable.'};

	if (asset._count.grants > 0) {
		return {
			ok: false,
			erreur:
				'Ce fichier a déjà été vendu : le retirer couperait l’accès des clients qui l’ont acheté. Ajoutez une nouvelle version à la place.',
		};
	}

	await prisma.digitalAsset.delete({where: {id: assetId}});

	// Le fichier disque part en second : une ligne supprimée sans son fichier
	// n'est qu'un octet perdu, l'inverse serait un lien mort en base.
	await unlink(cheminDe(asset.fileKey)).catch(() => {});

	return {ok: true};
}

/* Délivre les droits de téléchargement d'une commande payée, et renvoie les
   liens en clair — la seule fois où ils existent.

   **Idempotente.** Le webhook Stripe rejoue ses événements, et une commande
   peut aussi passer en payée à la main depuis le back-office. Un second appel
   ne crée rien et ne renvoie rien : les liens déjà envoyés restent les seuls
   valables.

   Le jeton est **stocké haché**, comme ceux des e-mails : une copie de la base
   ne permet pas de rejouer les téléchargements de tous les clients. C'est aussi
   pour cela que l'espace client ne passe pas par ce jeton — il n'existe plus
   nulle part une fois l'e-mail parti. */
export async function delivrerTelechargements(commandeId) {
	const commande = await prisma.order.findUnique({
		where: {id: commandeId},
		select: {
			id: true,
			email: true,
			userId: true,
			items: {
				where: {kind: 'DIGITAL'},
				select: {id: true, variantId: true, productName: true},
			},
		},
	});

	if (!commande || commande.items.length === 0) return {liens: []};

	const dejaDelivres = await prisma.downloadGrant.findMany({
		where: {orderItemId: {in: commande.items.map((ligne) => ligne.id)}},
		select: {orderItemId: true, digitalAssetId: true},
	});

	const connus = new Set(dejaDelivres.map((grant) => `${grant.orderItemId}:${grant.digitalAssetId}`));

	const expiration = new Date();
	expiration.setDate(expiration.getDate() + JOURS_VALIDITE);

	const liens = [];

	for (const ligne of commande.items) {
		if (!ligne.variantId) continue;

		/* Les fichiers sont retrouvés par la variante commandée : la ligne de
		   commande est une copie figée, elle ne porte pas le produit. Une variante
		   supprimée depuis (`onDelete: SetNull`) rend la délivrance impossible —
		   c'est une des raisons pour lesquelles un produit ne se supprime jamais. */
		const variante = await prisma.productVariant.findUnique({
			where: {id: ligne.variantId},
			select: {product: {select: {digitalAssets: true}}},
		});

		for (const asset of variante?.product?.digitalAssets ?? []) {
			if (connus.has(`${ligne.id}:${asset.id}`)) continue;

			const jeton = randomBytes(32).toString('base64url');

			await prisma.downloadGrant.create({
				data: {
					digitalAssetId: asset.id,
					orderItemId: ligne.id,
					userId: commande.userId,
					email: commande.email,
					token: empreinte(jeton),
					maxDownloads: MAX_TELECHARGEMENTS,
					expiresAt: expiration,
				},
			});

			liens.push({jeton, fileName: asset.fileName, produit: ligne.productName});
		}
	}

	return {liens};
}

/* Retrouve un droit par son jeton, sans rien consommer.

   Séparé de la consommation exprès : les clients de messagerie et les
   antivirus d'entreprise préchargent les liens qu'ils reçoivent. Si le simple
   fait d'ouvrir l'URL décomptait un téléchargement, un client pourrait perdre
   ses cinq essais sans avoir cliqué une seule fois. Cette fonction sert la page
   d'accueil du lien ; c'est le bouton, en POST, qui consomme. */
export async function lireDroitParJeton(jetonBrut) {
	if (typeof jetonBrut !== 'string' || jetonBrut.length === 0) return null;

	const hash = empreinte(jetonBrut);

	const droit = await prisma.downloadGrant.findUnique({
		where: {token: hash},
		include: {digitalAsset: true},
	});

	if (!droit) return null;

	/* Comparaison à temps constant sur l'empreinte : la recherche par index a
	   déjà tranché, c'est une ceinture en plus des bretelles. */
	const attendu = Buffer.from(droit.token, 'hex');
	const fourni = Buffer.from(hash, 'hex');

	if (attendu.length !== fourni.length || !timingSafeEqual(attendu, fourni)) return null;

	const expire = Boolean(droit.expiresAt && droit.expiresAt < new Date());
	const epuise = droit.downloadCount >= droit.maxDownloads;

	return {
		id: droit.id,
		fileName: droit.digitalAsset.fileName,
		sizeBytes: droit.digitalAsset.sizeBytes,
		restants: Math.max(0, droit.maxDownloads - droit.downloadCount),
		expiresAt: droit.expiresAt,
		utilisable: !expire && !epuise,
		/* Le motif du refus est dit au visiteur : contrairement à un jeton de
		   connexion, il n'y a rien à cacher ici — celui qui présente le lien l'a
		   déjà reçu, et « ça ne marche pas » sans raison ferait écrire au client. */
		motif: expire ? 'EXPIRE' : epuise ? 'EPUISE' : null,
	};
}

/* Consomme un téléchargement et renvoie de quoi servir le fichier.

   Le compteur avance dans la clause `where`, pas après une lecture : deux
   requêtes simultanées avec le même lien ne doivent pas passer toutes les deux
   sur le dernier téléchargement disponible. PostgreSQL évalue la condition et
   l'écriture en une opération, il n'y a pas d'intervalle exploitable. */
export async function consommerTelechargement(jetonBrut) {
	if (typeof jetonBrut !== 'string' || jetonBrut.length === 0) return null;

	const droit = await prisma.downloadGrant.findUnique({
		where: {token: empreinte(jetonBrut)},
		include: {digitalAsset: true},
	});

	if (!droit) return null;
	if (droit.expiresAt && droit.expiresAt < new Date()) return null;

	const consomme = await prisma.downloadGrant.updateMany({
		where: {id: droit.id, downloadCount: {lt: droit.maxDownloads}},
		data: {downloadCount: {increment: 1}},
	});

	if (consomme.count !== 1) return null;

	return droit.digitalAsset;
}

/* Les fichiers auxquels un compte a droit.

   Ni compteur ni expiration : c'est l'accès « à vie depuis le compte » promis
   au client. Le rattachement se fait par `userId` **ou** par l'adresse de la
   commande — quelqu'un qui a commandé en invité puis créé son compte avec la
   même adresse retrouve ses achats. */
export async function getTelechargementsDuCompte(userId, email) {
	const droits = await prisma.downloadGrant.findMany({
		where: {OR: [{userId}, {email: String(email ?? '').toLowerCase()}]},
		include: {
			digitalAsset: true,
			orderItem: {select: {productName: true, order: {select: {orderNumber: true, paidAt: true}}}},
		},
		orderBy: {createdAt: 'desc'},
	});

	/* Un même fichier acheté deux fois n'apparaît qu'une fois : la liste répond à
	   « qu'est-ce que je peux retélécharger ? », pas à « qu'est-ce que j'ai
	   acheté ? » — cette question-là, c'est l'historique des commandes. */
	const vus = new Set();

	return droits.filter((droit) => {
		if (vus.has(droit.digitalAssetId)) return false;
		vus.add(droit.digitalAssetId);
		return true;
	});
}

/* Le fichier d'un droit détenu par un compte connecté.

   L'identifiant du droit vient de l'URL : il est donc revérifié contre le
   compte qui le demande, sinon deviner un identifiant suffirait à télécharger
   l'ouvrage de quelqu'un d'autre. */
export async function getFichierDuCompte(grantId, userId, email) {
	const droit = await prisma.downloadGrant.findFirst({
		where: {
			id: grantId,
			OR: [{userId}, {email: String(email ?? '').toLowerCase()}],
		},
		include: {digitalAsset: true},
	});

	return droit?.digitalAsset ?? null;
}

/// Ouvre le fichier en lecture. Le flux évite de charger deux cents mégaoctets
/// en mémoire pour les envoyer octet par octet.
export async function ouvrirFichier(asset) {
	const chemin = cheminDe(asset.fileKey);

	// Vérifié avant d'ouvrir : un fichier disparu doit donner une erreur claire
	// côté serveur, pas un flux qui se coupe au milieu chez le client.
	await stat(chemin);

	return createReadStream(chemin);
}
