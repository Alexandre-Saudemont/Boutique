import {autoriseCron} from '@/server/auth/cron';
import {menageProgramme} from '@/server/services/maintenance';

/* Ménage programmé : jetons, sessions et paniers invités périmés.

   Deuxième et dernière raison d'exister de `src/app/api/` — un appelant externe
   qui a besoin d'une vraie route HTTP. Ici, l'ordonnanceur de l'hébergeur.

   À brancher sur une exécution quotidienne, par exemple avec Vercel Cron
   (`vercel.json`) :

     { "crons": [{ "path": "/api/cron/menage", "schedule": "0 4 * * *" }] }

   ou, sur une machine classique, une ligne de crontab :

     0 4 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
                    https://<domaine>/api/cron/menage

   Quatre heures du matin : la boutique dort, et une suppression en masse ne
   croise personne en train de commander.

   Rien de grave si le travail ne tourne jamais — les lignes périmées sont déjà
   refusées partout. C'est du ménage, pas un garde-fou. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(requete) {
	if (!autoriseCron(requete.headers.get('authorization'))) {
		/* 404 plutôt que 401 : à un appelant non autorisé, cette route n'a pas à
		   confirmer qu'elle existe. */
		return new Response('Introuvable.', {status: 404});
	}

	const rapport = await menageProgramme();

	/* Le compte-rendu part dans les journaux du serveur : c'est le seul endroit
	   où quelqu'un le lira, l'ordonnanceur, lui, ne regarde que le statut. */
	console.log('[ménage]', JSON.stringify(rapport));

	// 200 même en cas d'échec partiel : réessayer tout de suite ne réparerait
	// rien, et le prochain passage rattrapera. Le détail est dans le corps.
	return Response.json(rapport);
}
