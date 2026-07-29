import SiteHeader from '@/components/SiteHeader/SiteHeader';
import SiteFooter from '@/components/SiteFooter/SiteFooter';

/* Layout de la vitrine : toutes les pages publiques passent par ici.
   Le back-office a le sien dans (admin), avec sa sidebar sombre. */

/* Header et footer lisent la base (rayons, bandeau d'annonce). Sans cette
   ligne, Next les prérendrait une fois au build et les figerait : le client
   ajouterait un rayon depuis l'admin sans jamais le voir apparaître.

   Une minute est un compromis provisoire. Quand le back-office existera, on
   passera à une invalidation par tag — la page se régénérera à l'enregistrement
   plutôt qu'à intervalle fixe. */
export const revalidate = 60;

export default function SiteLayout({children}) {
	return (
		<div style={{display: 'flex', flexDirection: 'column', minHeight: '100dvh'}}>
			<a className='skip-link' href='#contenu'>
				Aller au contenu
			</a>

			<SiteHeader />

			{/* flex:1 colle le footer en bas même sur une page courte (404, panier vide). */}
			<main id='contenu' style={{flex: 1}}>
				{children}
			</main>

			<SiteFooter />
		</div>
	);
}
