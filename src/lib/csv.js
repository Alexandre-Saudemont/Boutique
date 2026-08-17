/* Fabrication de fichiers CSV lisibles par un tableur français.

   Deux problèmes que ce module règle une fois pour toutes, plutôt que dans
   chaque export.

   Le format d'abord : guillemets doublés, cellule entourée dès qu'elle contient
   un séparateur ou un retour à la ligne.

   La sécurité ensuite, et c'est le vrai motif de ce fichier. Une cellule qui
   commence par `=`, `+`, `-` ou `@` est interprétée comme une formule à
   l'ouverture du fichier. Or nos exports contiennent du texte saisi par des
   visiteurs — une adresse e-mail, un nom, une note de commande. Sans
   neutralisation, une valeur forgée à l'inscription s'exécute sur le poste de
   qui ouvre l'export, c'est-à-dire chez le client. On préfixe donc ces cellules
   d'une apostrophe, qui force le tableur à les lire comme du texte. */

const DEBUTS_DE_FORMULE = /^[=+\-@]/;

/* La virgule n'y figure pas, et c'est voulu : le séparateur est le
   point-virgule. L'entourer de guillemets serait inutile, et surtout nuisible
   sur les montants — « 45,90 » nu est lu comme un nombre par un tableur
   français, « "45,90" » risque de rester du texte et de casser les sommes. */
const CARACTERES_A_PROTEGER = /[";\n]/;

/// Échappe une cellule : neutralise les formules, puis protège le format.
export function celluleCsv(valeur) {
	const texte = String(valeur ?? '');
	const sur = DEBUTS_DE_FORMULE.test(texte) ? `'${texte}` : texte;

	return CARACTERES_A_PROTEGER.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur;
}

/* Assemble des lignes de cellules en un fichier complet.

   Séparateur point-virgule et BOM UTF-8 en tête : c'est ce qu'attend Excel en
   configuration française. Sans le BOM, les accents s'affichent en charabia ;
   avec une virgule, tout atterrit dans une seule colonne. */
export function versCsv(lignes) {
	return `﻿${lignes.map((ligne) => ligne.map(celluleCsv).join(';')).join('\r\n')}`;
}

/* Un montant en centimes, écrit comme un tableur français l'attend.

   Virgule décimale et rien d'autre : ni symbole monétaire, ni séparateur de
   milliers, ni espace insécable. `formatPrix` produit « 1 234,50 € », parfait à
   l'écran et inutilisable dans une colonne qu'on veut additionner — le tableur
   la lirait comme du texte. */
export function montantCsv(centimes) {
	return (centimes / 100).toFixed(2).replace('.', ',');
}

/* Une date en jj/mm/aaaa, dans le fuseau français.

   `formatDate` écrit « 3 août 2026 », parfait à l'écran et inutilisable dans
   une colonne : un tableur ne sait ni la trier ni la filtrer. Le fuseau est
   imposé parce qu'un encaissement du 1er janvier à 00 h 30 est enregistré en
   UTC le 31 décembre — il basculerait d'exercice à l'affichage. */
const FORMAT_DATE_CSV = new Intl.DateTimeFormat('fr-FR', {
	timeZone: 'Europe/Paris',
	day: '2-digit',
	month: '2-digit',
	year: 'numeric',
});

export function dateCsv(date) {
	return date ? FORMAT_DATE_CSV.format(new Date(date)) : '';
}
