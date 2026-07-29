/* Layout de la vitrine : toutes les pages publiques passent par ici.
   Le back-office a le sien dans (admin), avec sa sidebar sombre. */

export default function SiteLayout({children}) {
	return (
		<>
			<a className='skip-link' href='#contenu'>
				Aller au contenu
			</a>
			{/* Header et Footer arrivent à l'étape « charte visuelle ». */}
			<main id='contenu'>{children}</main>
		</>
	);
}
