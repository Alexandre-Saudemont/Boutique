import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Check, PackageCheck, RotateCcw, Truck} from 'lucide-react';
import {getProductBySlug, getRelatedProducts} from '@/server/services/products';
import {getModesLivraison} from '@/server/services/shipping';
import {getSettings} from '@/server/services/settings';
import {formatPrix, formatPrixCompact, pluriel} from '@/lib/format';
import {ETATS} from '@/lib/catalogue';
import ProductGallery from '@/components/ProductGallery/ProductGallery';
import ProductPurchase from '@/components/ProductPurchase/ProductPurchase';
import ProductTabs from '@/components/ProductTabs/ProductTabs';
import ProductCard from '@/components/ProductCard/ProductCard';
import styles from './produit.module.css';

/* Fiche produit.

   Page dynamique : le stock et le prix doivent être justes au chargement, pas
   figés à la génération. C'est le seul endroit du site où une donnée périmée
   coûte cher — un client qui commande une pièce affichée en stock alors qu'elle
   est partie. */

export async function generateMetadata({params}) {
	const {slug} = await params;
	const produit = await getProductBySlug(slug);

	if (!produit) return {title: 'Pièce introuvable'};

	return {
		title: produit.metaTitle ?? produit.nom,
		description: produit.metaDescription ?? produit.accroche ?? undefined,
		openGraph: {
			title: produit.nom,
			description: produit.accroche ?? undefined,
			images: produit.images[0] ? [produit.images[0].url] : undefined,
			type: 'website',
		},
	};
}

/* Les caractéristiques affichées viennent des vraies données du produit.
   On n'affiche que les lignes renseignées : un tableau à moitié vide fait plus
   négligé qu'un tableau court. */
function construireCaracteristiques(produit) {
	const variante = produit.varianteParDefaut;
	const lignes = [];

	if (produit.marque) lignes.push({cle: 'Marque', valeur: produit.marque.name});
	if (produit.licence) lignes.push({cle: 'Univers', valeur: produit.licence.name});
	if (produit.createur) lignes.push({cle: 'Créateur', valeur: produit.createur});

	for (const option of variante?.options ?? []) {
		lignes.push({cle: option.name, valeur: option.value});
	}

	if (variante?.weightGrams) {
		lignes.push({cle: 'Poids', valeur: `${variante.weightGrams} g`});
	}

	if (variante?.lengthMm && variante?.widthMm && variante?.heightMm) {
		lignes.push({
			cle: 'Dimensions',
			valeur: `${variante.lengthMm} × ${variante.widthMm} × ${variante.heightMm} mm`,
		});
	}

	lignes.push({cle: 'État', valeur: produit.etat.libelle});
	if (variante?.sku) lignes.push({cle: 'Référence', valeur: variante.sku});

	return lignes;
}

export default async function FicheProduit({params}) {
	const {slug} = await params;
	const produit = await getProductBySlug(slug);

	if (!produit) notFound();

	const [lies, modesLivraison, reglages] = await Promise.all([
		getRelatedProducts(produit.id, produit.rayonId),
		getModesLivraison(),
		getSettings(),
	]);

	const boutiqueOuverte = Boolean(reglages['shop.open']);
	const franco = reglages['shipping.freeAboveCents'];
	const stock = produit.varianteParDefaut?.stock ?? 0;

	const reassurance = [
		{
			icone: <Truck size={18} strokeWidth={2.75} />,
			titre: `Livraison offerte dès ${formatPrixCompact(franco)}`,
			sous: 'En France métropolitaine',
		},
		{
			icone: <PackageCheck size={18} strokeWidth={2.75} />,
			titre: 'Choisi et expédié à la main',
			sous: "Depuis l'atelier",
		},
		{
			icone: <RotateCcw size={18} strokeWidth={2.75} />,
			titre: 'Retours sous 14 jours',
			sous: 'Pièce non ouverte',
		},
	];

	return (
		<section className={styles.section}>
			<nav className={styles.fil} aria-label="Fil d'Ariane">
				<Link href='/'>Accueil</Link>
				<span aria-hidden='true'>/</span>
				<Link href='/boutique'>Boutique</Link>
				{produit.rayonSlug && (
					<>
						<span aria-hidden='true'>/</span>
						<Link href={`/boutique?rayon=${produit.rayonSlug}`}>{produit.rayon}</Link>
					</>
				)}
				<span aria-hidden='true'>/</span>
				<span className={styles.filCourant}>{produit.nom}</span>
			</nav>

			<div className={styles.grille}>
				<ProductGallery
					images={produit.images}
					nom={produit.nom}
					badge={produit.etat.cle === ETATS.PRECOMMANDE ? 'Précommande' : null}
				/>

				<div>
					{produit.rayon && <span className={styles.rayon}>{produit.rayon}</span>}

					<h1 className={styles.titre}>{produit.nom}</h1>

					<div className={styles.ligneePrix}>
						<span className={styles.prix}>
							{formatPrix(produit.prixCents)}
							{produit.prixBarreCents > produit.prixCents && (
								<span className={styles.prixBarre}>
									{formatPrix(produit.prixBarreCents)}
								</span>
							)}
						</span>

						<span className='tag tag-accent-2'>{produit.etat.libelle}</span>

						{stock > 0 ? (
							<span className={styles.stock}>
								<Check size={15} strokeWidth={2.75} />
								En stock — {pluriel(stock, 'pièce', 'pièces')}
							</span>
						) : (
							<span className={`${styles.stock} ${styles.stockEpuise}`}>
								{produit.enPrecommande ? 'Sur précommande' : 'Momentanément épuisé'}
							</span>
						)}
					</div>

					{produit.accroche && <p className={styles.description}>{produit.accroche}</p>}

					<ProductPurchase produit={produit} boutiqueOuverte={boutiqueOuverte} />

					<div className={styles.reassurance}>
						{reassurance.map((ligne) => (
							<div key={ligne.titre} className={styles.reassuranceLigne}>
								<span className={styles.reassuranceIcone} aria-hidden='true'>
									{ligne.icone}
								</span>
								<div className={styles.reassuranceTexte}>
									<span className={styles.reassuranceTitre}>{ligne.titre}</span>
									<br />
									<span className={styles.reassuranceSous}>{ligne.sous}</span>
								</div>
							</div>
						))}
					</div>

					<ProductTabs
						description={produit.description}
						caracteristiques={construireCaracteristiques(produit)}
						livraison={
							<>
								<p>
									Livraison offerte dès {formatPrixCompact(franco)} d&apos;achat en France
									métropolitaine. En dessous, voici les modes proposés :
								</p>
								<ul style={{margin: 0, paddingLeft: '1.2em'}}>
									{modesLivraison.map((mode) => (
										<li key={mode.id}>
											<strong>{mode.name}</strong> —{' '}
											{mode.priceCents === 0 ? 'gratuit' : formatPrix(mode.priceCents)}
											{mode.estimatedDays ? ` · ${mode.estimatedDays}` : ''}
										</li>
									))}
								</ul>
							</>
						}
					/>
				</div>
			</div>

			{lies.length > 0 && (
				<>
					<h2 className={styles.liesTitre}>Dans le même rayon</h2>
					<div className={styles.lies}>
						{lies.map((lie) => (
							<ProductCard
								key={lie.id}
								produit={lie}
								boutiqueOuverte={boutiqueOuverte}
							/>
						))}
					</div>
				</>
			)}
		</section>
	);
}
