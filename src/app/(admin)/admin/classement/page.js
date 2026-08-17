import Link from 'next/link';
import {exigerDroit} from '@/server/auth/roles';
import {TYPES_TAXONOMIE, descripteur, lister, typeConnu} from '@/server/services/taxonomies';
import TaxonomyTable from './TaxonomyTable';
import styles from '../../admin.module.css';

/* Rayons, marques et licences.

   Trois listes du même genre, réunies sous un seul écran avec des onglets dans
   l'URL. Trois entrées de menu pour trois tableaux quasi identiques auraient
   encombré la barre latérale sans rien clarifier.

   Le type vient de l'URL et n'est jamais cru sur parole : une valeur inconnue
   retombe sur les rayons plutôt que d'atteindre le service. */

export const metadata = {title: 'Classement'};

export default async function Classement({searchParams}) {
	await exigerDroit('produits.voir');

	const parametres = await searchParams;
	const type = typeConnu(parametres?.type) ? parametres.type : 'rayon';

	const [entrees, infos] = await Promise.all([lister(type), descripteur(type)]);

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<h1 className={styles.titre}>Classement</h1>
					<p className={styles.sousTitre}>
						Les rayons rangent la boutique, les marques disent qui fabrique, les
						licences disent de quel univers vient la pièce.
					</p>
				</div>
			</div>

			<div className={styles.contenu}>
				<div className={styles.filtres} style={{padding: '0 0 18px'}}>
					{TYPES_TAXONOMIE.map((entree) => (
						<Link
							key={entree.cle}
							href={`/admin/classement?type=${entree.cle}`}
							className={`${styles.puce} ${type === entree.cle ? styles.puceActive : ''}`}>
							{entree.pluriel}
						</Link>
					))}
				</div>

				<TaxonomyTable type={type} libelle={infos.libelle} entrees={entrees} />
			</div>
		</>
	);
}
