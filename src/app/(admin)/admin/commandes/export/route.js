import {exigerDroit} from '@/server/auth/roles';
import {livreDesRecettesEnCsv} from '@/server/services/orders';

/* Le livre des recettes d'un exercice, en téléchargement.

   Un gestionnaire de route et non une action serveur, pour la même raison que
   l'export des abonnés : une action renvoie des données à React, pas un fichier.

   Le droit demandé est `finances.voir` et non `commandes.voir`. Le service
   client consulte les commandes pour répondre au téléphone ; le chiffre
   d'affaires de l'année, lui, ne regarde que l'administrateur — c'est le revenu
   du foyer, pas une donnée d'équipe. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
	await exigerDroit('finances.voir');

	/* L'année vient de l'URL, donc de l'extérieur. On la ramène à un entier
	   plausible avant de l'utiliser : sans ça, `?annee=abc` construirait des
	   bornes invalides, et `?annee=999999` une requête absurde. */
	const demandee = Number(new URL(request.url).searchParams.get('annee'));
	const annee =
		Number.isInteger(demandee) && demandee >= 2020 && demandee <= 2100
			? demandee
			: new Date().getFullYear();

	const csv = await livreDesRecettesEnCsv(annee);

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="livre-des-recettes-${annee}.csv"`,
			// Le chiffre d'affaires et les noms des acheteurs n'ont rien à faire
			// dans un cache, ni du navigateur ni d'un intermédiaire.
			'Cache-Control': 'no-store',
		},
	});
}
