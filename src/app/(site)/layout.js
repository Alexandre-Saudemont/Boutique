import SiteHeader from '@/components/SiteHeader/SiteHeader';
import SiteFooter from '@/components/SiteFooter/SiteFooter';
import CookieBanner from '@/components/CookieBanner/CookieBanner';

/* Layout de la vitrine : toutes les pages publiques passent par ici.
   Le back-office a le sien dans (admin), avec sa sidebar sombre. */

/* Header et footer lisent la base (rayons, bandeau d'annonce). Sans cette
   ligne, Next les prérendrait une fois au build et les figerait : le client
   ajouterait un rayon depuis l'admin sans jamais le voir apparaître.

   La page est donc construite à chaque visite, pas au build. C'est aussi ce
   qui permet de construire le site sans base de données (Coolify construit
   dans un conteneur qui n'atteint pas toujours la base, et sur une base neuve
   les tables n'existent pas encore). */
export const dynamic = 'force-dynamic';

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

			{/* Après le footer dans l'ordre du document : le bandeau est fixé à
			    l'écran, il n'a pas à s'intercaler dans la lecture au clavier. */}
			<CookieBanner />
		</div>
	);
}
