import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft} from 'lucide-react';
import {exigerDroit} from '@/server/auth/roles';
import {getProduitPourEdition, getReferentiels} from '@/server/services/product-admin';
import {formatDate} from '@/lib/format';
import ProductForm from '../ProductForm';
import ArchiveButton from './ArchiveButton';
import DigitalFiles from './DigitalFiles';
import styles from '../../../admin.module.css';

/* Modification d'un produit.

   Le formulaire reçoit le produit tel qu'il est en base, variantes et images
   comprises. Rien n'est mis en cache : on modifie ce qu'on vient de lire, pas
   une version d'il y a une minute. */

export async function generateMetadata({params}) {
	const {id} = await params;
	const produit = await getProduitPourEdition(id);

	return {title: produit ? produit.name : 'Produit'};
}

export default async function ModifierProduit({params, searchParams}) {
	await exigerDroit('produits.gerer');

	const [{id}, parametres] = await Promise.all([params, searchParams]);

	const [produit, referentiels] = await Promise.all([
		getProduitPourEdition(id),
		getReferentiels(),
	]);

	if (!produit) notFound();

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<Link href='/admin/produits' className={styles.retour}>
						<ArrowLeft size={16} strokeWidth={2.75} />
						Tous les produits
					</Link>
					<h1 className={styles.titre}>{produit.name}</h1>
					<p className={styles.sousTitre}>
						Modifié le {formatDate(produit.updatedAt)}
						{produit.publishedAt && ` · en ligne depuis le ${formatDate(produit.publishedAt)}`}
						{produit.archivedAt && ' · archivé'}
					</p>
				</div>

				<div className={styles.actionsTitre}>
					{produit.publishedAt && (
						<Link href={`/produit/${produit.slug}`} className='btn btn-secondary'>
							Voir la fiche
						</Link>
					)}
					<ArchiveButton id={produit.id} archive={Boolean(produit.archivedAt)} />
				</div>
			</div>

			<div className={styles.contenu}>
				{parametres?.enregistre === '1' && (
					<p className={styles.succes}>Produit enregistré.</p>
				)}

				<ProductForm produit={produit} referentiels={referentiels} />

				{/* Seulement sur un ouvrage numérique : sur une figurine, ce bloc n'a
				    rien à dire et ferait douter de ce qu'on est en train de vendre. */}
				{produit.kind === 'DIGITAL' && (
					<DigitalFiles
						produitId={produit.id}
						fichiers={produit.digitalAssets.map((asset) => ({
							id: asset.id,
							fileName: asset.fileName,
							sizeBytes: asset.sizeBytes,
							createdAt: asset.createdAt,
							ventes: asset._count.grants,
						}))}
					/>
				)}
			</div>
		</>
	);
}
