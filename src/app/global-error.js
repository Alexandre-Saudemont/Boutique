'use client';

/* Le dernier filet : une erreur survenue dans le layout racine lui-même.

   Ce fichier remplace le layout racine — il pose donc son propre `<html>` et
   son propre `<body>`, et ne peut compter ni sur les polices chargées par
   `layout.js`, ni sur les tokens de `organic.css`. D'où des styles écrits en
   dur ici, seul endroit du projet où c'est justifié : le fichier doit
   s'afficher correctement même quand tout le reste a échoué.

   En pratique on ne le voit presque jamais. C'est justement ce qu'on attend
   d'un filet. */

export default function ErreurGlobale({error, reset}) {
	return (
		<html lang='fr'>
			<body
				style={{
					margin: 0,
					minHeight: '100dvh',
					display: 'grid',
					placeItems: 'center',
					background: '#f5ead8',
					color: '#2a2118',
					fontFamily: 'system-ui, -apple-system, sans-serif',
				}}>
				<main style={{textAlign: 'center', maxWidth: '520px', padding: '48px 24px'}}>
					<h1 style={{fontSize: '32px', lineHeight: 1.1, margin: '0 0 14px'}}>
						Le site est momentanément indisponible
					</h1>

					<p style={{fontSize: '17px', lineHeight: 1.6, margin: '0 0 28px'}}>
						Une panne nous empêche d’afficher quoi que ce soit. Réessayez dans
						un instant.
					</p>

					<button
						type='button'
						onClick={reset}
						style={{
							font: 'inherit',
							fontWeight: 600,
							cursor: 'pointer',
							border: 'none',
							borderRadius: '16px',
							padding: '12px 26px',
							background: '#c67139',
							color: '#f5ead8',
						}}>
						Réessayer
					</button>

					{error?.digest ? (
						<p style={{marginTop: '34px', fontSize: '14px', opacity: 0.7}}>
							Référence de l’incident : <code>{error.digest}</code>
						</p>
					) : null}
				</main>
			</body>
		</html>
	);
}
