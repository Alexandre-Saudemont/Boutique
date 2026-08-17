/* L'adresse publique du site.

   Elle sert partout où il faut une URL absolue et où aucune requête n'est
   disponible pour la déduire : liens des e-mails, balises de partage, sitemap,
   robots.txt. Le repli sur localhost n'a de sens qu'en développement — en
   production, `NEXT_PUBLIC_SITE_URL` doit être renseignée, sans quoi les liens
   envoyés aux clients ne mèneraient nulle part et le sitemap déclarerait des
   adresses inaccessibles aux moteurs.

   La barre oblique finale est retirée ici, une fois pour toutes : les appelants
   concatènent des chemins qui commencent déjà par `/`, et une adresse notée
   avec ou sans barre dans le `.env` ne doit pas produire deux URL différentes
   pour la même page. */

export function adresseDuSite() {
	return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}
