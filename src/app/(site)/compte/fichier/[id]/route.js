import {getUtilisateurCourant} from '@/server/auth/session';
import {estRequeteDuSite} from '@/server/auth/origine';
import {getFichierDuCompte, ouvrirFichier, typeSur} from '@/server/services/digital';

/* Le téléchargement depuis le compte.

   Le pendant de `/telechargement/[jeton]`, sans jeton et sans compteur : ici la
   preuve est la session, donc l'identité. C'est l'accès « à vie » promis au
   client — le lien envoyé par e-mail expire, le compte non.

   L'identifiant vient de l'URL et n'est jamais cru sur parole : le service le
   revérifie contre le compte qui demande. Sans ce contrôle, deviner un
   identifiant suffirait à télécharger l'ouvrage de quelqu'un d'autre. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(requete, {params}) {
	if (!estRequeteDuSite(requete)) {
		return new Response('Requête refusée.', {status: 403});
	}

	const utilisateur = await getUtilisateurCourant();
	if (!utilisateur) return new Response('Connectez-vous.', {status: 401});

	const {id} = await params;

	const asset = await getFichierDuCompte(id, utilisateur);

	// Droit inexistant ou appartenant à quelqu'un d'autre : même réponse. Le
	// second cas n'a pas à se distinguer du premier.
	if (!asset) return new Response('Fichier introuvable.', {status: 404});

	let flux;

	try {
		flux = await ouvrirFichier(asset);
	} catch (erreur) {
		console.error(`[telechargement] fichier absent pour l'asset ${asset.id} :`, erreur);
		return new Response('Le fichier est momentanément indisponible.', {status: 500});
	}

	return new Response(flux, {
		headers: {
			'Content-Type': typeSur(asset.mimeType),
			'Content-Length': String(asset.sizeBytes),
			'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
			'Cache-Control': 'private, no-store',
		},
	});
}
