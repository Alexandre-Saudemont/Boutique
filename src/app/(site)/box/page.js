import Link from 'next/link';
import {getTaillesBox, listerBoxes} from '@/server/services/boxes';
import {getSettings} from '@/server/services/settings';
import {formatPrixCompact} from '@/lib/format';
import ProductCard from '@/components/ProductCard/ProductCard';
import styles from './box.module.css';

/* Les box surprises.

   La maquette montrait un configurateur — thème, taille, préférences, un mot
   pour le vieux geek — et un récapitulatif qui se met à jour. Ce n'est pas ce
   qui est construit ici, pour une raison de fond : rien en base ne saurait
   porter ces préférences jusqu'à la commande. Il faudrait un champ sur la ligne
   de commande, un affichage en préparation, et un test pour garantir que la
   note du client ne se perd pas entre le panier et l'atelier. C'est un chantier
   à part entière, pas une page.

   Ce qui est construit se tient debout tout seul : les box du rayon, filtrables
   par taille, achetables par le tunnel existant. Le client peut déjà en vendre
   demain matin. Le configurateur, s'il le veut, viendra se poser dessus.

   La taille filtre sur les variantes : choisir « M » ne montre que les box qui
   existent en M, au prix du M — pas au prix d'appel du S. */

export const metadata = {
	title: 'Les box surprises',
	description:
		'Un thème, une taille, et je remplis le reste à la main. Chaque box est une pioche différente, jamais deux fois la même.',
};

const ETAPES = [
	{
		titre: 'Vous choisissez',
		texte: 'Un thème, une taille. C’est tout ce que vous avez à décider — le reste est ma part du jeu.',
	},
	{
		titre: 'Je pioche',
		texte: 'Je remplis votre box à la main, dans le stock que je garde à part pour ça. Deux box du même thème ne se ressemblent jamais.',
	},
	{
		titre: 'Je note ce qu’il y a dedans',
		texte: 'Le contenu de votre box est consigné à la préparation. Six mois plus tard, je peux encore vous dire ce que vous aviez reçu.',
	},
];

export default async function Box({searchParams}) {
	const parametres = await searchParams;

	const [tailles, reglages] = await Promise.all([getTaillesBox(), getSettings()]);

	/* Une taille inventée dans l'URL ne doit pas atteindre la requête : on ne
	   garde que celles qui existent vraiment, et on retombe sur « toutes »
	   sinon. Même règle que les filtres de la boutique. */
	const tailleActive =
		tailles.find((taille) => taille.nom.toLowerCase() === String(parametres.taille ?? '').toLowerCase())
			?.nom ?? null;

	const boxes = await listerBoxes({taille: tailleActive});
	const boutiqueOuverte = Boolean(reglages['shop.open']);

	return (
		<>
			<section className={styles.intro}>
				<div className={styles.blob} aria-hidden='true' />

				<div className={styles.introContenu}>
					<span className='tag tag-accent-2' style={{marginBottom: 14}}>
						Préparée à la main
					</span>

					<h1 className={styles.titre}>Les box surprises de l&apos;antre</h1>

					<p className={styles.chapeau}>
						Choisissez un thème et une taille — je remplis le reste à la main. Chaque box est une
						pioche différente, jamais deux fois la même caverne.
					</p>
				</div>
			</section>

			<section className={styles.section}>
				{tailles.length > 0 && (
					<div className={styles.barreTailles}>
						<span className={styles.libelleTailles}>Taille</span>

						<nav className={styles.tailles} aria-label='Filtrer par taille'>
							<Link
								href='/box'
								className={`${styles.taille} ${tailleActive ? '' : styles.tailleActive}`}
								aria-current={tailleActive ? undefined : 'true'}>
								<span className={styles.tailleNom}>Toutes</span>
							</Link>

							{tailles.map((taille) => (
								<Link
									key={taille.nom}
									href={`/box?taille=${encodeURIComponent(taille.nom.toLowerCase())}`}
									className={`${styles.taille} ${
										tailleActive === taille.nom ? styles.tailleActive : ''
									}`}
									aria-current={tailleActive === taille.nom ? 'true' : undefined}>
									<span className={styles.tailleNom}>{taille.nom}</span>
									<span className={styles.taillePrix}>
										dès {formatPrixCompact(taille.prixCents)}
									</span>
								</Link>
							))}
						</nav>
					</div>
				)}

				{boxes.length > 0 ? (
					<div className={styles.cartes}>
						{boxes.map((box) => (
							<ProductCard key={box.id} produit={box} boutiqueOuverte={boutiqueOuverte} />
						))}
					</div>
				) : (
					<p className={styles.vide}>
						{tailleActive
							? 'Aucune box dans cette taille pour l’instant — essayez une autre.'
							: 'Les box se préparent encore. Revenez à l’ouverture.'}
					</p>
				)}
			</section>

			<section className={styles.etapes}>
				<div className={styles.etapesContenu}>
					<h2 className={styles.titreSection}>Comment ça marche</h2>

					<ol className={styles.listeEtapes}>
						{ETAPES.map((etape, rang) => (
							<li key={etape.titre}>
								<span className={styles.numero} aria-hidden='true'>
									{rang + 1}
								</span>

								<h3 className={styles.etapeTitre}>{etape.titre}</h3>
								<p className={styles.etapeTexte}>{etape.texte}</p>
							</li>
						))}
					</ol>
				</div>
			</section>
		</>
	);
}
