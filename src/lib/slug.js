/* Le slug : ce qui apparaît dans l'URL.

   Pas de `server-only` : la fonction est pure et sert aussi bien à l'écriture en
   base qu'à un aperçu d'adresse pendant la saisie.

   Les accents sont décomposés puis retirés — `NFD` sépare « é » en « e » suivi
   d'un accent combinant, et la plage U+0300–U+036F attrape ces accents. Tout ce
   qui n'est ni lettre ni chiffre devient un tiret. Une URL qui contient des
   accents ou des espaces s'encode en %C3%A9 dès qu'elle est copiée-collée, et
   devient illisible partout où elle est partagée. */
export function slugifier(texte) {
	return String(texte ?? '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}
