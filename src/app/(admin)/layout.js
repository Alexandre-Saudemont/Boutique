import {aLeDroit, exigerStaff} from '@/server/auth/roles';
import {compterCommandesATraiter} from '@/server/services/orders';
import {seDeconnecter} from '@/app/(site)/compte/actions';
import AdminSidebar from '@/components/AdminSidebar/AdminSidebar';
import styles from './admin.module.css';

/* Layout du back-office.

   La porte du back-office est ici, et nulle part ailleurs : `exigerStaff` court
   avant chaque page du groupe. Un layout Next s'exécute à chaque rendu de page
   enfant, ce qui en fait le bon endroit pour un contrôle d'accès — impossible
   d'ajouter une page dans ce dossier en oubliant de la protéger.

   Chaque page revérifie tout de même le droit précis dont elle a besoin. Ce
   n'est pas redondant : ce layout dit « vous travaillez ici », la page dit
   « vous avez le droit de faire ça ». */

export const metadata = {
	title: {template: '%s · Back-office', default: 'Back-office'},
	// Aucune page d'administration n'a à se retrouver dans un moteur de
	// recherche, même protégée derrière une connexion.
	robots: {index: false, follow: false},
};

const ENTREES = [
	{cle: 'tableau', libelle: 'Tableau de bord', href: '/admin', droit: null},
	{cle: 'commandes', libelle: 'Commandes', href: '/admin/commandes', droit: 'commandes.voir'},
	{cle: 'produits', libelle: 'Produits', href: '/admin/produits', droit: 'produits.voir'},
];

export default async function AdminLayout({children}) {
	const utilisateur = await exigerStaff();

	// Le préparateur voit la pastille, le service client aussi : elle dit ce
	// qu'il reste à faire, pas ce que ça rapporte.
	const aTraiter = aLeDroit(utilisateur, 'commandes.voir') ? await compterCommandesATraiter() : 0;

	const entrees = ENTREES.filter((e) => !e.droit || aLeDroit(utilisateur, e.droit)).map((e) => ({
		cle: e.cle,
		libelle: e.libelle,
		href: e.href,
		pastille: e.cle === 'commandes' ? aTraiter : 0,
	}));

	return (
		<div className={styles.coque}>
			<AdminSidebar entrees={entrees} utilisateur={utilisateur} seDeconnecter={seDeconnecter} />

			<main className={styles.principal}>{children}</main>
		</div>
	);
}
