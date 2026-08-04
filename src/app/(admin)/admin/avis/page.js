import Link from 'next/link';
import {exigerDroit} from '@/server/auth/roles';
import {LIBELLES_MODERATION, listerAvisAdmin} from '@/server/services/reviews';
import {pluriel} from '@/lib/format';
import ReviewCard from './ReviewCard';
import styles from '../../admin.module.css';

/* Modération des avis.

   Les avis en attente arrivent en premier, et les plus anciens d'abord : c'est
   celui qui patiente depuis trois jours qu'il faut traiter, pas le dernier
   déposé. Un client qui attend une semaine que son avis paraisse ne revient
   pas en écrire un second. */

export const metadata = {title: 'Avis'};

const FILTRES = [
	{cle: 'PENDING', libelle: 'À modérer'},
	{cle: 'APPROVED', libelle: 'Publiés'},
	{cle: 'REJECTED', libelle: 'Refusés'},
	{cle: 'TOUS', libelle: 'Tous'},
];

export default async function Avis({searchParams}) {
	await exigerDroit('avis.moderer');

	const parametres = await searchParams;
	const statut = FILTRES.some((f) => f.cle === parametres?.statut) ? parametres.statut : 'PENDING';

	const avis = await listerAvisAdmin({statut});

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<h1 className={styles.titre}>Avis</h1>
					<p className={styles.sousTitre}>
						{pluriel(avis.length, 'avis', 'avis')}
						{statut !== 'TOUS' && ` · ${LIBELLES_MODERATION[statut].toLowerCase()}`}
					</p>
				</div>
			</div>

			<div className={styles.contenu}>
				<div className={styles.filtres} style={{padding: '0 0 18px'}}>
					{FILTRES.map((filtre) => (
						<Link
							key={filtre.cle}
							href={`/admin/avis?statut=${filtre.cle}`}
							className={`${styles.puce} ${statut === filtre.cle ? styles.puceActive : ''}`}>
							{filtre.libelle}
						</Link>
					))}
				</div>

				{avis.length === 0 ? (
					<div className={styles.carte}>
						<p className={styles.kpiDetail}>
							{statut === 'PENDING'
								? 'Rien n’attend votre lecture — tout est à jour.'
								: 'Aucun avis dans cette vue.'}
						</p>
					</div>
				) : (
					avis.map((entree) => <ReviewCard key={entree.id} avis={entree} />)
				)}
			</div>
		</>
	);
}
