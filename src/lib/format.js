/* Formatage à l'affichage.

   Pas de `server-only` ici : ces fonctions servent des deux côtés — le serveur
   pour le rendu initial, le client pour un total de panier qui se recalcule.

   Les montants circulent partout en centimes (Int). La conversion en euros
   n'arrive qu'au tout dernier moment, à l'affichage. */

const FORMAT_EURO = new Intl.NumberFormat('fr-FR', {
	style: 'currency',
	currency: 'EUR',
});

/// 7490 → « 74,90 € »
export function formatPrix(centimes) {
	if (typeof centimes !== 'number' || !Number.isFinite(centimes)) return '';
	return FORMAT_EURO.format(centimes / 100);
}

const FORMAT_EURO_ENTIER = new Intl.NumberFormat('fr-FR', {
	style: 'currency',
	currency: 'EUR',
	maximumFractionDigits: 0,
});

/* Montant sans centimes quand il tombe rond : 5000 → « 50 € », 7490 → « 74,90 € ».

   À réserver aux seuils annoncés en clair (« livraison offerte dès 50 € »), où
   « 50,00 € » fait lourd et s'écarte de ce qu'écrit le design. Les prix de vente
   gardent toujours leurs centimes — un « 74 € » arrondi serait faux. */
export function formatPrixCompact(centimes) {
	if (typeof centimes !== 'number' || !Number.isFinite(centimes)) return '';
	return centimes % 100 === 0
		? FORMAT_EURO_ENTIER.format(centimes / 100)
		: FORMAT_EURO.format(centimes / 100);
}

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
});

export function formatDate(date) {
	if (!date) return '';
	return FORMAT_DATE.format(new Date(date));
}

/// 250 → « 250 g », 1500 → « 1,5 kg ». `null`/`undefined` → « — » : le poids
/// n'est pas toujours renseigné, contrairement au prix.
export function formatPoids(grammes) {
	if (typeof grammes !== 'number' || !Number.isFinite(grammes)) return '—';
	if (grammes < 1000) return `${grammes} g`;
	const kilos = grammes / 1000;
	return `${kilos % 1 === 0 ? kilos : kilos.toFixed(1).replace('.', ',')} kg`;
}

/// Accorde un nom au pluriel et le préfixe de son nombre.
/// pluriel(1, 'pièce en vitrine', 'pièces en vitrine') → « 1 pièce en vitrine »
export function pluriel(nombre, singulier, plurielForme) {
	// En français, 0 et 1 prennent le singulier — contrairement à l'anglais pour 0.
	return `${nombre} ${nombre > 1 ? plurielForme : singulier}`;
}
