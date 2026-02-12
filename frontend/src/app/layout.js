import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import AppShell from '@/components/AppShell/AppShell';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
});

export const metadata = {
	title: 'Boutique Jeux de Société',
	description: 'Votre boutique en ligne de jeux de société',
};

export default function RootLayout({children}) {
	return (
		<html lang='fr'>
			<body className={`${geistSans.variable} ${geistMono.variable}`}>
				<AppShell>{children}</AppShell>
			</body>
		</html>
	);
}
