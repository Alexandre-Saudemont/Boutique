'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {
	archiverProduit,
	enregistrerProduit,
	restaurerProduit,
} from '@/server/services/product-admin';
import {enregistrerFichier, supprimerFichier} from '@/server/services/digital';
import {ACTIONS, journaliser} from '@/server/services/audit';

/* Actions du catalogue.

   Le formulaire poste des tableaux parallèles pour les variantes
   (`varianteId`, `variantePrix`…) : c'est la façon dont un navigateur envoie
   une liste de lignes, et ça évite d'empaqueter du JSON dans un champ caché —
   qui casserait silencieusement le jour où un caractère spécial passe par là.

   Le regroupement se fait ici, à l'entrée du serveur, pour que le service
   reçoive une structure propre et n'ait jamais à connaître la forme d'un
   formulaire HTML. */

function lireVariantes(donnees) {
	const ids = donnees.getAll('varianteId');

	return ids.map((id, index) => ({
		id: id || null,
		nom: donnees.getAll('varianteNom')[index] ?? 'Standard',
		sku: donnees.getAll('varianteSku')[index] ?? '',
		prix: donnees.getAll('variantePrix')[index] ?? '',
		stock: donnees.getAll('varianteStock')[index] ?? '0',
		etat: donnees.getAll('varianteEtat')[index] ?? 'EN_VENTE',
	}));
}

function lireImages(donnees) {
	const urls = donnees.getAll('imageUrl');

	return urls.map((url, index) => ({
		url: String(url ?? ''),
		alt: donnees.getAll('imageAlt')[index] ?? '',
	}));
}

export async function sauvegarderProduit(_precedent, donnees) {
	const utilisateur = await exigerDroit('produits.gerer');

	const saisie = {
		id: donnees.get('id') || null,
		nom: donnees.get('nom'),
		kind: donnees.get('kind'),
		condition: donnees.get('condition'),
		accroche: donnees.get('accroche'),
		description: donnees.get('description'),
		categorieId: donnees.get('categorieId'),
		marqueId: donnees.get('marqueId'),
		licenceId: donnees.get('licenceId'),
		precommande: donnees.get('precommande') === 'on',
		boxSurprise: donnees.get('boxSurprise') === 'on',
		publication: donnees.get('publication'),
		variantes: lireVariantes(donnees),
		images: lireImages(donnees),
	};

	const resultat = await enregistrerProduit(saisie);

	if (!resultat.ok) {
		return {statut: 'erreur', erreurs: resultat.erreurs, message: 'Corrigez les champs signalés.'};
	}

	/* Le prix et l'état de publication sont journalisés : ce sont les deux
	   valeurs sur lesquelles on revient quand quelque chose cloche en boutique. */
	await journaliser({
		utilisateurId: utilisateur.id,
		action: saisie.id ? ACTIONS.PRODUIT_MODIFIE : ACTIONS.PRODUIT_CREE,
		type: 'product',
		id: resultat.id,
		details: {
			nom: saisie.nom,
			publication: saisie.publication,
			prix: saisie.variantes.map((variante) => variante.prix),
		},
	});

	/* La fiche publique, la liste du catalogue et le tableau de bord affichent
	   tous ce produit. Le layout de la vitrine porte le menu des rayons, qui
	   dépend lui aussi du catalogue. */
	revalidatePath('/admin/produits');
	revalidatePath('/', 'layout');

	// Une création part sur sa fiche d'édition : l'écran suivant est presque
	// toujours « ajouter les photos » ou « corriger un détail ».
	redirect(`/admin/produits/${resultat.id}?enregistre=1`);
}

export async function archiver(_precedent, donnees) {
	const utilisateur = await exigerDroit('produits.gerer');
	const id = String(donnees.get('id'));

	await archiverProduit(id);

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.PRODUIT_ARCHIVE,
		type: 'product',
		id,
	});

	revalidatePath('/admin/produits');
	revalidatePath('/', 'layout');

	redirect('/admin/produits');
}

/* Ajoute un fichier à un ouvrage numérique.

   Le fichier arrive en mémoire — c'est ce que fait une action serveur — puis
   part sur le disque. `bodySizeLimit` dans `next.config.mjs` est ce qui empêche
   un envoi démesuré d'y arriver, et le service revérifie la taille : la limite
   du cadre et celle du métier ne sont pas la même chose et doivent tenir toutes
   les deux.

   Le type déclaré par le navigateur n'est pas une preuve — il vient du client,
   comme tout le reste. Il sert à écarter les envois manifestement hors sujet et
   à rendre le fichier avec le bon en-tête ; ce qui protège vraiment, c'est que
   rien de ce dossier n'est jamais exécuté ni servi depuis une URL publique. */
export async function televerserFichierNumerique(_precedent, donnees) {
	const utilisateur = await exigerDroit('produits.gerer');

	const produitId = String(donnees.get('produitId') ?? '');
	const fichier = donnees.get('fichier');

	if (!fichier || typeof fichier.arrayBuffer !== 'function' || fichier.size === 0) {
		return {statut: 'erreur', message: 'Choisissez un fichier.'};
	}

	const resultat = await enregistrerFichier({
		productId: produitId,
		fileName: fichier.name,
		mimeType: fichier.type,
		contenu: Buffer.from(await fichier.arrayBuffer()),
	});

	if (!resultat.ok) return {statut: 'erreur', message: resultat.erreur};

	/* Le nom du fichier entre au journal, pas son contenu : c'est ce qu'on veut
	   pouvoir relire pour savoir quelle version a été mise en vente et quand. */
	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.FICHIER_AJOUTE,
		type: 'digital_asset',
		id: resultat.asset.id,
		details: {produitId, nom: resultat.asset.fileName, octets: resultat.asset.sizeBytes},
	});

	revalidatePath(`/admin/produits/${produitId}`);

	return {statut: 'ok'};
}

/// Retire un fichier. Le service refuse dès qu'il a été vendu — l'accès promis
/// aux acheteurs ne doit pas pouvoir se couper d'un clic.
export async function retirerFichierNumerique(_precedent, donnees) {
	const utilisateur = await exigerDroit('produits.gerer');

	const assetId = String(donnees.get('assetId') ?? '');
	const produitId = String(donnees.get('produitId') ?? '');

	const resultat = await supprimerFichier(assetId);

	if (!resultat.ok) return {statut: 'erreur', message: resultat.erreur};

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.FICHIER_RETIRE,
		type: 'digital_asset',
		id: assetId,
		details: {produitId},
	});

	revalidatePath(`/admin/produits/${produitId}`);

	return {statut: 'ok'};
}

export async function restaurer(_precedent, donnees) {
	const utilisateur = await exigerDroit('produits.gerer');
	const id = String(donnees.get('id'));

	await restaurerProduit(id);

	await journaliser({
		utilisateurId: utilisateur.id,
		action: ACTIONS.PRODUIT_RESTAURE,
		type: 'product',
		id,
	});

	revalidatePath('/admin/produits');
	revalidatePath('/', 'layout');

	return {statut: 'ok', message: 'Produit remis en brouillon.'};
}
