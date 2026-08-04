import {estRequeteDuSite} from '@/server/auth/origine';
import {consommerTelechargement, ouvrirFichier, typeSur} from '@/server/services/digital';

/* Le flux du fichier.

   Un gestionnaire de route, et pas une Server Action, parce qu'il faut renvoyer
   des octets et des en-têtes — une action serveur renvoie des données, pas une
   réponse HTTP. Il vit à côté de sa page plutôt que dans `src/app/api/` : ce
   n'est pas une API pour un client externe, c'est la seconde moitié d'un écran.

   **POST seulement.** Un GET serait déclenché par le préchargement d'un client
   de messagerie, d'un antivirus d'entreprise ou d'un aperçu de lien dans une
   messagerie instantanée — le client perdrait ses téléchargements sans avoir
   rien fait. La page d'atterrissage lit le droit sans le consommer ; ici, on
   consomme. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(requete, {params}) {
	/* Un site tiers ne doit pas pouvoir faire brûler les cinq téléchargements
	   d'un lien depuis le navigateur du client. */
	if (!estRequeteDuSite(requete)) {
		return new Response('Requête refusée.', {status: 403});
	}

	const {jeton} = await params;

	/* La consommation fait partie de la vérification, en une écriture
	   conditionnelle : deux requêtes simultanées sur le dernier téléchargement
	   disponible ne doivent pas passer toutes les deux. */
	const asset = await consommerTelechargement(jeton);

	if (!asset) {
		/* Jeton inconnu, expiré ou épuisé : même réponse. Le détail est donné sur
		   la page, où le visiteur peut le lire — pas ici, où il n'y a personne
		   pour l'afficher. */
		return new Response('Ce lien n’est plus valable.', {status: 404});
	}

	let flux;

	try {
		flux = await ouvrirFichier(asset);
	} catch (erreur) {
		/* Le droit vient d'être consommé et le fichier manque : c'est une erreur
		   d'exploitation, pas du visiteur. On la journalise pour qu'elle se voie —
		   le client, lui, écrira. */
		console.error(`[telechargement] fichier absent pour l'asset ${asset.id} :`, erreur);
		return new Response('Le fichier est momentanément indisponible.', {status: 500});
	}

	return new Response(flux, {
		headers: {
			'Content-Type': typeSur(asset.mimeType),
			'Content-Length': String(asset.sizeBytes),
			/* Le nom d'origine est proposé au client. Encodé selon la RFC 5987 : un
			   nom accentué ou porteur d'un guillemet casserait sinon l'en-tête, et un
			   nom contenant un retour à la ligne permettrait d'en injecter d'autres. */
			'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
			// Un fichier acheté n'a rien à faire dans un cache partagé.
			'Cache-Control': 'private, no-store',
		},
	});
}
