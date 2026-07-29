import Link from 'next/link';
import {getRayons} from '@/server/services/categories';
import {getSettings} from '@/server/services/settings';
import {countByRayon, listProducts} from '@/server/services/products';
import {ETATS, LIBELLES_ETAT, normaliserEtat, normaliserTri} from '@/lib/catalogue';
import {pluriel} from '@/lib/format';
import ProductCard from '@/components/ProductCard/ProductCard';
import TriSelect from './TriSelect';
import styles from './boutique.module.css';

/* La boutique.

   Les filtres vivent dans l'URL plutôt que dans un état React : un rayon filtré
   se partage par lien, se met en favori, et remonte dans les moteurs de
   recherche. Ce sont donc de vrais liens, qui fonctionnent sans JavaScript.
   Seul le tri est un <select>, faute d'équivalent en HTML pur. */

export const metadata = {
	title: 'La boutique',
	description:
		'Figurines, mangas, jeux de société, JDR et goodies — neuf et occasion contrôlée. Les étagères se garnissent pièce par pièce.',
};

/// Construit une URL de filtre en conservant les autres paramètres actifs.
function lienFiltre({rayon, etat, tri}) {
	const parametres = new URLSearchParams();
	if (rayon) parametres.set('rayon', rayon);
	if (etat) parametres.set('etat', etat);
	if (tri) parametres.set('tri', tri);

	const chaine = parametres.toString();
	return chaine ? `/boutique?${chaine}` : '/boutique';
}

export default async function Boutique({searchParams}) {
	const parametres = await searchParams;

	const rayonActif = parametres.rayon ?? null;
	const etatActif = normaliserEtat(parametres.etat);
	const triActif = normaliserTri(parametres.tri);

	const [rayons, reglages, produits, compteurs] = await Promise.all([
		getRayons(),
		getSettings(),
		listProducts({rayon: rayonActif, etat: etatActif, tri: triActif}),
		/* Les compteurs suivent le filtre d'état mais pas celui de rayon :
		   ils doivent montrer ce qu'on trouverait en changeant de rayon, pas ce
		   que contient le rayon déjà sélectionné. */
		countByRayon({etat: etatActif}),
	]);

	const boutiqueOuverte = Boolean(reglages['shop.open']);

	return (
		<>
			<section className={styles.intro}>
				<div className={styles.blob} aria-hidden='true' />

				<div className={styles.introContenu}>
					<div>
						{!boutiqueOuverte && (
							<span className='tag tag-accent' style={{marginBottom: 14}}>
								Boutique en construction · Aperçu du rayon
							</span>
						)}

						<h1 className={styles.titre}>La boutique</h1>

						<p className={styles.chapeau}>
							Les étagères se garnissent pièce par pièce. Voici l&apos;inventaire
							tel qu&apos;il prend forme — l&apos;ajout au panier s&apos;activera à
							l&apos;ouverture, une fois le stock au complet.
						</p>
					</div>

					{!boutiqueOuverte && (
						<div className={styles.pastilleOuverture}>
							<span className={styles.point} aria-hidden='true' />
							<span className={styles.pastilleTexte}>
								Ouverture à venir — pas encore de date
							</span>
						</div>
					)}
				</div>
			</section>

			<section className={styles.section}>
				<div className={styles.grille}>
					<aside className={styles.sidebar} aria-label='Filtres'>
						<div>
							<h2 className={styles.titreFiltre}>Rayon</h2>
							<nav className={styles.listeRayons}>
								<Link
									href={lienFiltre({etat: etatActif, tri: triActif})}
									className={`${styles.filtreRayon} ${
										rayonActif ? '' : styles.filtreRayonActif
									}`}
									aria-current={rayonActif ? undefined : 'true'}>
									<span>Tout</span>
									<span className={styles.compteur}>{compteurs.total}</span>
								</Link>

								{rayons.map((rayon) => (
									<Link
										key={rayon.id}
										href={lienFiltre({
											rayon: rayon.slug,
											etat: etatActif,
											tri: triActif,
										})}
										className={`${styles.filtreRayon} ${
											rayonActif === rayon.slug ? styles.filtreRayonActif : ''
										}`}
										aria-current={rayonActif === rayon.slug ? 'true' : undefined}>
										<span>{rayon.name}</span>
										<span className={styles.compteur}>
											{compteurs.parCategorie[rayon.id] ?? 0}
										</span>
									</Link>
								))}
							</nav>
						</div>

						<div>
							<h2 className={styles.titreFiltre}>État</h2>
							<div className={styles.chips}>
								<Link
									href={lienFiltre({rayon: rayonActif, tri: triActif})}
									className={`${styles.chip} ${etatActif ? '' : styles.chipActif}`}
									aria-current={etatActif ? undefined : 'true'}>
									Tous
								</Link>

								{Object.values(ETATS).map((etat) => (
									<Link
										key={etat}
										href={lienFiltre({rayon: rayonActif, etat, tri: triActif})}
										className={`${styles.chip} ${
											etatActif === etat ? styles.chipActif : ''
										}`}
										aria-current={etatActif === etat ? 'true' : undefined}>
										{LIBELLES_ETAT[etat]}
									</Link>
								))}
							</div>
						</div>

						<div className={styles.encart}>
							<h2 className={styles.encartTitre}>Prévenez-moi</h2>
							<p className={styles.encartTexte}>
								Un mail dès que le panier ouvre et que ces pièces partent en vente.
							</p>
							<Link
								href='/#newsletter'
								className='btn btn-primary btn-block'
								style={{padding: '9px 14px', fontSize: 14}}>
								M&apos;inscrire
							</Link>
						</div>
					</aside>

					<div>
						<div className={styles.barreListe}>
							<span className={styles.nombre}>
								{pluriel(produits.length, 'pièce en vitrine', 'pièces en vitrine')}
							</span>

							<div className={styles.tri}>
								<span className={styles.triLabel}>Trier</span>
								<TriSelect valeur={triActif} />
							</div>
						</div>

						{produits.length > 0 ? (
							<div className={styles.cartes}>
								{produits.map((produit) => (
									<ProductCard
										key={produit.id}
										produit={produit}
										boutiqueOuverte={boutiqueOuverte}
									/>
								))}
							</div>
						) : (
							<p className={styles.vide}>
								Ce rayon n&apos;est pas encore garni — repassez à l&apos;ouverture.
							</p>
						)}

						{!boutiqueOuverte && (
							<div className={styles.appel}>
								<h2 className={styles.appelTitre}>
									L&apos;inventaire complet arrive à l&apos;ouverture
								</h2>
								<p className={styles.appelTexte}>
									Ce que vous voyez ici n&apos;est qu&apos;un premier tiroir de la
									caverne. Inscrivez-vous pour être prévenu dès que tout le stock
									bascule en vente.
								</p>
								<Link
									href='/#newsletter'
									className='btn btn-primary'
									style={{padding: '11px 24px', fontSize: 15}}>
									Être prévenu de l&apos;ouverture
								</Link>
							</div>
						)}
					</div>
				</div>
			</section>
		</>
	);
}
