/* Accueil — provisoire.
   Sert pour l'instant de vérification que la charte Organic est bien chargée
   (police Caprasimo, fond crème, accent terracotta). Remplacé par le vrai
   hero et ses sections à l'étape suivante. */

export default function Accueil() {
	return (
		<div className='shell' style={{paddingBlock: 'var(--space-8)'}}>
			<h1>L&apos;antre du vieux geek fou</h1>
			<p className='text-muted'>
				Socle en place. Les écrans arrivent.
			</p>
			<span className='tag tag-accent'>Ouverture imminente</span>
		</div>
	);
}
