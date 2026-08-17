import SiteHeader from '@/components/SiteHeader/SiteHeader';
import SiteFooter from '@/components/SiteFooter/SiteFooter';
import PageIntrouvable from '@/components/PageIntrouvable/PageIntrouvable';

/* Le 404 des adresses qui ne correspondent à aucune route — une faute de
   frappe, un vieux lien, un robot qui teste `/wp-login.php`.

   Celui-là ne traverse pas le layout de la vitrine : Next le rend directement
   sous le layout racine. Il repose donc lui-même son en-tête et son pied de
   page, faute de quoi le visiteur atterrirait sur un écran nu, sans aucun moyen
   de repartir vers le catalogue. */

/* Même cadence que le layout de la vitrine : l'en-tête lit les rayons en base,
   il ne doit pas rester figé sur l'état du jour de la mise en ligne. */
export const revalidate = 60;

export const metadata = {
	title: 'Page introuvable',
};

export default function NonTrouve() {
	return (
		<div style={{display: 'flex', flexDirection: 'column', minHeight: '100dvh'}}>
			<a className='skip-link' href='#contenu'>
				Aller au contenu
			</a>

			<SiteHeader />

			<main id='contenu' style={{flex: 1}}>
				<PageIntrouvable />
			</main>

			<SiteFooter />
		</div>
	);
}
