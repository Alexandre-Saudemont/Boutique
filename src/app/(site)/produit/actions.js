'use server';

import {revalidatePath} from 'next/cache';
import {getUtilisateurCourant} from '@/server/auth/session';
import {verifierLimite} from '@/server/auth/rate-limit';
import {deposerAvis} from '@/server/services/reviews';

/* Dépôt d'un avis.

   L'identité vient de la session, jamais du formulaire : le nom affiché sous
   l'avis est celui du compte. Sans cette règle, n'importe qui pourrait signer
   « Le Vieux geek » un avis élogieux.

   La limite protège d'un compte qui déposerait des avis en série sur tout le
   catalogue. Elle est large — le service refuse déjà un second avis sur la
   même pièce, c'est le balayage du catalogue qu'on freine ici. */
export async function laisserUnAvis(_precedent, donnees) {
	const utilisateur = await getUtilisateurCourant();

	if (!utilisateur) {
		return {statut: 'erreur', message: 'Connectez-vous pour laisser un avis.'};
	}

	const limite = verifierLimite(`avis:${utilisateur.id}`, {max: 5, fenetreMs: 60 * 60 * 1000});

	if (!limite.autorise) {
		return {
			statut: 'erreur',
			message: 'Vous avez déposé plusieurs avis récemment — reprenez dans une heure.',
		};
	}

	const resultat = await deposerAvis({
		productId: String(donnees.get('produitId') ?? ''),
		utilisateur,
		note: donnees.get('note'),
		titre: donnees.get('titre'),
		contenu: donnees.get('contenu'),
	});

	if (!resultat.ok) {
		return {statut: 'erreur', message: resultat.erreur, erreurs: resultat.erreurs};
	}

	/* En modération préalable, rien ne change à l'écran pour les autres
	   visiteurs — mais la page doit se régénérer pour l'auteur, dont le
	   formulaire cède la place au message de confirmation. */
	revalidatePath('/produit/[slug]', 'page');

	return {statut: 'depose', enAttente: resultat.enAttente};
}
