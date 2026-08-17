import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import {exigerDroit} from '@/server/auth/roles';
import {getReferentiels} from '@/server/services/product-admin';
import ProductForm from '../ProductForm';
import styles from '../../../admin.module.css';

/* Création d'un produit.

   Même formulaire que la modification, sans produit à charger. Le nouveau
   produit naît en brouillon : on le relit, on ajoute les photos, puis on
   publie. Publier d'un clic depuis un formulaire vide met des fiches à moitié
   remplies en vitrine. */

export const metadata = {title: 'Nouveau produit'};

export default async function NouveauProduit() {
	await exigerDroit('produits.gerer');

	const referentiels = await getReferentiels();

	return (
		<>
			<div className={styles.barreTitre}>
				<div>
					<Link href='/admin/produits' className={styles.retour}>
						<ArrowLeft size={16} strokeWidth={2.75} />
						Tous les produits
					</Link>
					<h1 className={styles.titre}>Nouveau produit</h1>
					<p className={styles.sousTitre}>
						L’essentiel suffit pour commencer — tout reste modifiable.
					</p>
				</div>
			</div>

			<div className={styles.contenu}>
				<ProductForm produit={null} referentiels={referentiels} />
			</div>
		</>
	);
}
