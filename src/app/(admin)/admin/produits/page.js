import Link from 'next/link';
import {Plus} from 'lucide-react';
import {aLeDroit, exigerDroit} from '@/server/auth/roles';
import {listerProduitsAdmin} from '@/server/services/products';
import {pluriel} from '@/lib/format';
import InventaireTableau from './InventaireTableau';
import styles from '../../admin.module.css';

/* Inventaire.

   Ce qui est en ligne, ce qui dort en brouillon, ce qui va manquer. Chaque nom
   ouvre la fiche d'édition — pour qui a le droit d'y toucher ; le préparateur,
   lui, consulte l'inventaire sans pouvoir modifier les prix. */

export const metadata = {title: 'Produits'};

export default async function Produits({searchParams}) {
	const utilisateur = await exigerDroit('produits.voir');
	const peutGerer = aLeDroit(utilisateur, 'produits.gerer');

	const parametres = await searchParams;
	const inclureArchives = parametres?.archives === '1';
	const triVues = parametres?.tri === 'vues';

	const produits = await listerProduitsAdmin({inclureArchives, triVues});

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<h1 className={styles.titre}>Produits</h1>
					<p className={styles.sousTitre}>
						{pluriel(produits.length, 'référence', 'références')}
						{inclureArchives ? ', archives comprises' : ''}
					</p>
				</div>

				{peutGerer && (
					<div className={styles.actionsTitre}>
						<Link href='/admin/produits/nouveau' className='btn btn-primary' style={{gap: 8}}>
							<Plus size={17} strokeWidth={2.75} />
							Ajouter un produit
						</Link>
					</div>
				)}
			</div>

			<div className={styles.contenu}>
				<div className={styles.tableauCadre}>
					<div className={styles.filtres}>
						<Link
							href='/admin/produits'
							className={`${styles.puce} ${!inclureArchives ? styles.puceActive : ''}`}>
							En catalogue
						</Link>
						<Link
							href='/admin/produits?archives=1'
							className={`${styles.puce} ${inclureArchives ? styles.puceActive : ''}`}>
							Avec les archives
						</Link>
						{/* Le tri par vues garde le filtre d'archives en cours : changer de
						    tri ne doit pas faire disparaître les archives qu'on regardait. */}
						<Link
							href={`/admin/produits?${new URLSearchParams({
								...(inclureArchives ? {archives: '1'} : {}),
								tri: 'vues',
							})}`}
							className={`${styles.puce} ${triVues ? styles.puceActive : ''}`}
							style={{marginLeft: 'auto'}}>
							Les plus regardés
						</Link>
					</div>

					{produits.length === 0 ? (
						<p className={styles.vide}>
							Aucun produit pour l’instant. Le catalogue se remplit depuis la base en
							attendant l’écran de saisie.
						</p>
					) : (
						<InventaireTableau produits={produits} peutGerer={peutGerer} />
					)}
				</div>
			</div>
		</>
	);
}
