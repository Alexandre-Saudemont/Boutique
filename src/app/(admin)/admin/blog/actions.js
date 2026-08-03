'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {exigerDroit} from '@/server/auth/roles';
import {depublierArticle, enregistrerArticle} from '@/server/services/posts';

/* Actions du blog.

   Le droit demandé est `reglages.gerer` : écrire sur le site au nom de la
   boutique engage son image autant que changer ses réglages. Un préparateur n'a
   pas à publier un article, et ce n'était pas prévu dans le découpage des rôles.
   Le jour où quelqu'un est embauché pour écrire, un droit `blog.gerer` viendra
   s'ajouter — c'est une ligne dans `roles.js`. */

export async function sauvegarderArticle(_precedent, donnees) {
	const utilisateur = await exigerDroit('reglages.gerer');

	const resultat = await enregistrerArticle({
		id: donnees.get('id') || null,
		titre: donnees.get('titre'),
		chapeau: donnees.get('chapeau'),
		contenu: donnees.get('contenu'),
		image: donnees.get('image'),
		statut: donnees.get('statut'),
		auteurId: utilisateur.id,
	});

	if (!resultat.ok) {
		return {statut: 'erreur', erreurs: resultat.erreurs, message: 'Corrigez les champs signalés.'};
	}

	revalidatePath('/admin/blog');
	// L'accueil affiche les derniers articles.
	revalidatePath('/', 'layout');

	redirect(`/admin/blog/${resultat.id}?enregistre=1`);
}

export async function depublier(_precedent, donnees) {
	await exigerDroit('reglages.gerer');

	await depublierArticle(String(donnees.get('id')));

	revalidatePath('/admin/blog');
	revalidatePath('/', 'layout');

	return {statut: 'ok', message: 'Article repassé en brouillon.'};
}
