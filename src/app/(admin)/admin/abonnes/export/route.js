import {exigerDroit} from '@/server/auth/roles';
import {abonnesEnCsv} from '@/server/services/newsletter';

/* Export CSV de la liste.

   Un gestionnaire de route et non une action serveur : une action renvoie des
   données à React, pas un fichier à télécharger. Il fallait ici une vraie
   réponse HTTP, avec son type de contenu et son nom de fichier.

   C'est la seule route de ce genre hors des webhooks. Elle est protégée comme
   une page — `exigerDroit` avant tout le reste — parce qu'une adresse qui rend
   la liste complète des e-mails du client ne doit jamais répondre à un visiteur
   de passage. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
	await exigerDroit('abonnes.voir');

	const csv = await abonnesEnCsv();
	const date = new Date().toISOString().slice(0, 10);

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="abonnes-${date}.csv"`,
			// Une liste d'adresses n'a rien à faire dans un cache, ni du navigateur
			// ni d'un intermédiaire.
			'Cache-Control': 'no-store',
		},
	});
}
