'use server';

import {revalidatePath} from 'next/cache';
import {addItem, getCart, removeItem, setQuantity} from '@/server/services/cart';
import {ensureCartToken, getCartToken} from '@/server/auth/cart-session';
import {effacerCodePromo, setCodePromo} from '@/server/auth/promo-session';
import {verifierCode} from '@/server/services/discounts';
import {verifierLimite} from '@/server/auth/rate-limit';

/* Actions du panier.

   Chacune revalide `/panier` et la page courante : le récapitulatif, la pastille
   du header et les lignes doivent repartir du serveur après modification, sinon
   l'affichage montre l'état d'avant le clic.

   Les vérifications (boutique ouverte, stock, appartenance de la ligne) vivent
   dans le service, pas ici : une action serveur est appelable directement, on ne
   peut pas s'en remettre à l'écran qui l'a déclenchée. */

/* Revalide ce que la modification a rendu faux. Le layout de la vitrine porte
   le header et sa pastille : sans lui, le compteur resterait figé d'une page à
   l'autre. */
function rafraichir() {
	revalidatePath('/panier');
	revalidatePath('/', 'layout');
}

export async function ajouterAuPanier(_precedent, donnees) {
	const varianteId = donnees.get('varianteId');
	const quantite = donnees.get('quantite');

	// Le jeton n'est créé qu'ici : c'est le premier ajout qui fait naître le
	// panier, pas la simple visite d'une fiche produit.
	const jeton = await ensureCartToken();
	const resultat = await addItem(jeton, varianteId, quantite);

	if (!resultat.ok) {
		return {statut: 'erreur', message: resultat.erreur};
	}

	rafraichir();

	return {
		statut: 'ajoute',
		quantite: resultat.quantite,
		message: resultat.plafonne
			? `Il ne reste que ${resultat.quantite} pièce(s) — c'est ce que j'ai mis au panier.`
			: null,
	};
}

/* Applique un code de réduction.

   Le code est vérifié tout de suite pour pouvoir dire pourquoi il ne passe pas
   — expiré, montant insuffisant, épuisé. Il n'est posé en cookie que s'il est
   valable : un code refusé ne doit pas rester collé au panier et réafficher son
   erreur à chaque page.

   La vérification est refaite à chaque affichage et à la commande. Celle-ci
   n'est là que pour expliquer. */
export async function appliquerCode(_precedent, donnees) {
	const code = String(donnees.get('code') ?? '');
	const jeton = await getCartToken();
	const panier = await getCart(jeton);

	if (panier.lignes.length === 0) {
		return {statut: 'erreur', message: 'Votre panier est vide.'};
	}

	/* Les codes sont courts et se devinent : sans limite, ce champ sert à les
	   énumérer jusqu'à en trouver un valable. */
	const limite = verifierLimite(`promo:${jeton}`, {max: 10, fenetreMs: 10 * 60 * 1000});

	if (!limite.autorise) {
		return {statut: 'erreur', message: 'Trop d’essais. Reprenez dans quelques minutes.'};
	}

	const resultat = await verifierCode(code, panier.sousTotalCents);

	if (!resultat.ok) return {statut: 'erreur', message: resultat.erreur};

	await setCodePromo(resultat.promo.code);

	rafraichir();

	return {statut: 'applique'};
}

export async function retirerCode() {
	await effacerCodePromo();

	rafraichir();
}

export async function changerQuantite(ligneId, quantite) {
	const jeton = await getCartToken();
	await setQuantity(jeton, ligneId, quantite);
	rafraichir();
}

export async function retirerDuPanier(ligneId) {
	const jeton = await getCartToken();
	await removeItem(jeton, ligneId);
	rafraichir();
}
