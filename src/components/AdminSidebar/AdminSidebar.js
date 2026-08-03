'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {
	BookOpen,
	LayoutDashboard,
	LogOut,
	Mail,
	Package,
	ScrollText,
	Settings,
	SquareArrowOutUpRight,
	Tags,
	Truck,
} from 'lucide-react';
import styles from './AdminSidebar.module.css';

/* Navigation du back-office.

   Composant client pour une seule raison : `usePathname`, qui met en évidence
   la rubrique courante. Tout le reste — qui a le droit de voir quoi — est
   décidé côté serveur ; ce composant ne reçoit que les entrées déjà filtrées.
   Un lien absent d'ici n'est pas une protection, c'est de la lisibilité : la
   page elle-même revérifie le droit. */

const ICONES = {
	tableau: LayoutDashboard,
	commandes: ScrollText,
	produits: Package,
	classement: Tags,
	livraison: Truck,
	blog: BookOpen,
	abonnes: Mail,
	reglages: Settings,
};

const LIBELLES_ROLE = {
	ADMIN: 'Administrateur',
	STAFF_ORDERS: 'Préparation des commandes',
	STAFF_SUPPORT: 'Service client',
};

export default function AdminSidebar({entrees, utilisateur, seDeconnecter}) {
	const chemin = usePathname();

	const initiale = (utilisateur.firstName ?? utilisateur.email).charAt(0).toUpperCase();
	const nom =
		[utilisateur.firstName, utilisateur.lastName].filter(Boolean).join(' ') || utilisateur.email;

	return (
		<aside className={styles.barre}>
			<div className={styles.marque}>
				<span className={styles.marqueSurtitre}>Back-office</span>
				<span className={styles.marqueNom}>vieux geek fou</span>
			</div>

			<nav className={styles.nav} aria-label='Sections du back-office'>
				{entrees.map((entree) => {
					const Icone = ICONES[entree.cle];

					/* Le tableau de bord ne s'allume que sur son adresse exacte : sans
					   ça, `/admin/commandes` commençant par `/admin`, il resterait
					   surligné partout. */
					const actif =
						entree.href === '/admin' ? chemin === '/admin' : chemin.startsWith(entree.href);

					return (
						<Link
							key={entree.cle}
							href={entree.href}
							aria-current={actif ? 'page' : undefined}
							className={`${styles.lien} ${actif ? styles.lienActif : ''}`}>
							<Icone size={17} strokeWidth={2.75} />
							<span className={styles.libelle}>{entree.libelle}</span>
							{entree.pastille > 0 && (
								<span className={styles.pastille}>{entree.pastille}</span>
							)}
						</Link>
					);
				})}
			</nav>

			<div className={styles.pied}>
				<Link href='/' className={styles.lien}>
					<SquareArrowOutUpRight size={16} strokeWidth={2.75} />
					<span className={styles.libelle}>Voir le site</span>
				</Link>

				<div className={styles.compte}>
					<span className={styles.avatar} aria-hidden='true'>
						{initiale}
					</span>
					<div className={styles.compteInfos}>
						<div className={styles.compteNom}>{nom}</div>
						<div className={styles.compteRole}>
							{LIBELLES_ROLE[utilisateur.role] ?? utilisateur.role}
						</div>
					</div>
				</div>

				{/* L'action de déconnexion est passée par le serveur : ce composant ne
				    connaît ni la session ni le cookie, il n'expose qu'un bouton. */}
				<form action={seDeconnecter}>
					<button type='submit' className={styles.deconnexion}>
						<LogOut size={16} strokeWidth={2.75} />
						Se déconnecter
					</button>
				</form>
			</div>
		</aside>
	);
}
