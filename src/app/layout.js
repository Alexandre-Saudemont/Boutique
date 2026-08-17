import {Caprasimo, Figtree} from 'next/font/google';
import '@/styles/globals.css';
import {adresseDuSite} from '@/lib/site-url';

/* Les deux familles du design system Organic. next/font les auto-héberge :
   aucune requête vers Google au chargement de la page. Les variables CSS
   exposées ici alimentent --font-heading et --font-body dans organic.css. */

const caprasimo = Caprasimo({
	variable: '--font-caprasimo',
	subsets: ['latin'],
	weight: '400',
	display: 'swap',
});

const figtree = Figtree({
	variable: '--font-figtree',
	subsets: ['latin'],
	weight: ['400', '600', '700'],
	display: 'swap',
});

export const metadata = {
	/* Le point de départ des adresses absolues que Next fabrique tout seul :
	   images de partage, liens canoniques. Sans cette ligne, il les construit
	   sur `localhost` et prévient dans les journaux de build. */
	metadataBase: new URL(adresseDuSite()),
	title: {
		default: "L'antre du vieux geek fou",
		template: "%s · L'antre du vieux geek fou",
	},
	description:
		'Figurines, mangas, jeux de société, JDR et goodies. Neuf et occasion contrôlée, expédié de France.',
};

export default function RootLayout({children}) {
	return (
		<html lang='fr' className={`${caprasimo.variable} ${figtree.variable}`}>
			<body>{children}</body>
		</html>
	);
}
