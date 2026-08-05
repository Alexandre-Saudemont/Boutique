import Link from 'next/link';
import {getRayons} from '@/server/services/categories';
import {getSettings} from '@/server/services/settings';
import styles from './SiteFooter.module.css';

/* Pied de page de la vitrine.

   Les rayons viennent de la base : quand le client en ajoute un depuis l'admin,
   il apparaît ici sans intervention. Les liens d'aide et les mentions légales
   sont fixes, ce sont des pages du site.

   Les moyens de paiement listés en bas suivent le réglage : annoncer PayPal
   sur toutes les pages alors que le tunnel ne le propose pas ferait découvrir
   l'absence au moment de payer — le pire endroit pour une mauvaise surprise. */

const LIENS_AIDE = [
	{libelle: 'Contact', href: '/contact'},
	{libelle: 'FAQ', href: '/contact#faq'},
	{libelle: 'Livraison & retours', href: '/legal#cgv'},
	{libelle: 'Suivi de commande', href: '/compte'},
	{libelle: 'Mon compte', href: '/compte'},
];

const LIENS_LEGAL = [
	{libelle: 'Mentions légales', href: '/legal#mentions'},
	{libelle: 'CGV', href: '/legal#cgv'},
	{libelle: 'Confidentialité', href: '/legal#confidentialite'},
	{libelle: 'Gestion des cookies', href: '/legal#cookies'},
];

export default async function SiteFooter() {
	const [rayons, reglages] = await Promise.all([getRayons(), getSettings()]);

	const moyens = ['CB', reglages['payment.paypalEnabled'] && 'PayPal'].filter(Boolean);

	return (
		<footer className={styles.footer}>
			<div className={styles.grille}>
				<div>
					<div className={styles.marque}>
						<span className={styles.marqueHaut}>L&apos;antre du</span>
						<span className={styles.marqueBas}>vieux geek fou</span>
					</div>
					<p className={styles.description}>
						Boutique indépendante de pop culture — figurines, mangas, jeux, box
						surprises. Neuf &amp; occasion, expédié depuis la France.
					</p>
				</div>

				<div>
					<div className={styles.titreColonne}>Rayons</div>
					<ul className={styles.liens}>
						{rayons.map((rayon) => (
							<li key={rayon.id}>
								<Link href={`/boutique?rayon=${rayon.slug}`}>{rayon.name}</Link>
							</li>
						))}
						<li>
							<Link href='/ichiban-kuji'>Ichiban Kuji</Link>
						</li>
					</ul>
				</div>

				<div>
					<div className={styles.titreColonne}>Aide</div>
					<ul className={styles.liens}>
						{LIENS_AIDE.map((lien) => (
							<li key={lien.libelle}>
								<Link href={lien.href}>{lien.libelle}</Link>
							</li>
						))}
					</ul>
				</div>

				<div>
					<div className={styles.titreColonne}>Légal</div>
					<ul className={styles.liens}>
						{LIENS_LEGAL.map((lien) => (
							<li key={lien.libelle}>
								<Link href={lien.href}>{lien.libelle}</Link>
							</li>
						))}
					</ul>
				</div>
			</div>

			<div className={styles.barreBasse}>
				<div className={styles.barreBasseContenu}>
					<span>
						© {new Date().getFullYear()} L&apos;antre du vieux geek fou — Tous
						droits réservés.
					</span>
					<span>
						Paiement sécurisé · {moyens.join(' · ')} · Mondial Relay · Colissimo
					</span>
				</div>
			</div>
		</footer>
	);
}
