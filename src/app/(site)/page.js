import {getRayons} from '@/server/services/categories';
import {getSettings} from '@/server/services/settings';

/* Accueil — provisoire.

   Elle sert pour l'instant à vérifier la chaîne complète : charte Organic
   chargée, et données lues en base par les services. Le vrai hero et ses
   sections arrivent avec les écrans.

   À noter, c'est le motif qu'on répétera partout : la page est un Server
   Component, elle appelle le service en await, directement. Pas de fetch, pas
   de route API au milieu. */

export default async function Accueil() {
	const [rayons, reglages] = await Promise.all([getRayons(), getSettings()]);

	return (
		<div className='shell' style={{paddingBlock: 'var(--space-8)'}}>
			<h1>{reglages['shop.name']}</h1>

			<p className='text-muted'>Socle en place. Les écrans arrivent.</p>

			{!reglages['shop.open'] && (
				<span className='tag tag-accent'>Ouverture imminente</span>
			)}

			<h2 style={{marginTop: 'var(--space-8)'}}>Les rayons</h2>
			<ul style={{display: 'grid', gap: 'var(--space-2)', listStyle: 'none', padding: 0}}>
				{rayons.map((rayon) => (
					<li key={rayon.id}>
						<strong>{rayon.name}</strong>{' '}
						<span className='text-muted'>— {rayon.description}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
