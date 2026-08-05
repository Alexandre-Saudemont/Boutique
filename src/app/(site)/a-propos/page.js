import Link from 'next/link';
import {RefreshCw, ShieldCheck, Sparkles} from 'lucide-react';
import styles from './apropos.module.css';

/* La page « à propos ».

   Le texte est celui de la maquette, retouché : les détails inventés (la ville,
   le portrait) ont sauté. C'est du contenu d'attente — il figure dans les points
   restés en suspens côté client (voir docs/QUESTIONS-CLIENT.md, point 14), et
   sera remplacé par le récit du vrai vieux geek. La page, elle, n'attend rien. */

export const metadata = {
	title: 'L’histoire de l’antre',
	description:
		'Comment une étagère qui débordait est devenue une boutique. Neuf choisi, occasion contrôlée, colis préparés à la main.',
};

const VALEURS = [
	{
		icone: ShieldCheck,
		titre: 'L’honnêteté avant tout',
		texte:
			'L’état d’une pièce est décrit tel qu’il est, photos réelles à l’appui. Pas de mauvaise surprise à l’ouverture du colis.',
	},
	{
		icone: Sparkles,
		titre: 'La main, pas l’algorithme',
		texte:
			'Chaque pièce est choisie, chaque box remplie, chaque colis préparé à la main. Rien n’est automatisé pour vous vendre plus.',
	},
	{
		icone: RefreshCw,
		titre: 'La transmission',
		texte:
			'Réparer plutôt que jeter, faire découvrir plutôt que garder pour soi. Une culture, ça se partage.',
	},
];

const ETAPES = [
	{
		titre: 'Je chine',
		texte: 'Marchés, brocantes, collections, arrivages neufs : je cherche des pièces qui valent le coup.',
	},
	{
		titre: 'Je vérifie',
		texte: 'Nettoyage, test, remise en état si besoin. Ce qui ne tient pas la route est écarté.',
	},
	{
		titre: 'Je photographie',
		texte: 'Vraies photos, description honnête. Vous savez exactement ce que vous achetez.',
	},
	{
		titre: 'J’expédie',
		texte: 'Colis renforcé, calé avec soin, envoyé avec suivi. Direction votre étagère.',
	},
];

export default function APropos() {
	return (
		<>
			<section className={styles.hero}>
				<div className={styles.blob} aria-hidden='true' />

				<div className={styles.heroContenu}>
					<div>
						<span className='tag tag-outline' style={{marginBottom: 20}}>
							L&apos;histoire de l&apos;antre
						</span>

						<h1 className={styles.titre}>Un vieux geek, une caverne, une obsession</h1>

						<p className={styles.chapeau}>
							L&apos;antre n&apos;est pas né d&apos;un business plan. Il est né d&apos;une étagère qui
							débordait, puis d&apos;une pièce entière, puis de l&apos;envie de partager tout ça avec des
							gens qui comprennent.
						</p>
					</div>

					<figure className={styles.portrait}>
						<span className={styles.portraitLettre} aria-hidden='true'>
							A
						</span>
					</figure>
				</div>
			</section>

			<section className={styles.recit}>
				<p>
					Tout a commencé avec une figurine achetée sur un marché, il y a bien longtemps. Puis une
					deuxième. Les mangas ont suivi, les jeux, les vieilles consoles récupérées pour trois fois rien
					et remises en état à la lampe de bureau.
				</p>

				<p>
					À force de chiner, de réparer et de collectionner, il a fallu se rendre à l&apos;évidence : la
					caverne était pleine, et j&apos;avais accumulé bien plus de savoir et de trouvailles que je ne
					pouvais en garder pour moi seul. L&apos;antre est devenu une boutique pour que ces pièces
					trouvent d&apos;autres passionnés — et pour continuer la chasse.
				</p>

				<blockquote className={styles.citation}>
					<p>
						« Je ne vends pas des objets. Je passe le relais de trucs que j&apos;ai aimés, à des gens
						qui vont les aimer à leur tour. »
					</p>
				</blockquote>

				<p>
					Aujourd&apos;hui, l&apos;antre c&apos;est du neuf soigneusement choisi, de l&apos;occasion
					contrôlée avec honnêteté, des box préparées à la main, et un blog où je raconte tout ce que
					cette culture m&apos;inspire. Le tout, sans algorithme et sans rayon sans âme.
				</p>
			</section>

			<section className={styles.section}>
				<h2 className={styles.titreSection}>Ce à quoi je tiens</h2>

				<div className={styles.valeurs}>
					{VALEURS.map((valeur) => {
						const Icone = valeur.icone;

						return (
							<article key={valeur.titre} className={styles.valeur}>
								<span className={styles.icone} aria-hidden='true'>
									<Icone size={24} strokeWidth={2.75} />
								</span>

								<h3 className={styles.valeurTitre}>{valeur.titre}</h3>
								<p className={styles.valeurTexte}>{valeur.texte}</p>
							</article>
						);
					})}
				</div>
			</section>

			<section className={styles.coulisses}>
				<div className={styles.coulissesContenu}>
					<div className={styles.coulissesEntete}>
						<span className={styles.kicker}>Les coulisses</span>
						<h2 className={styles.titreSection} style={{marginBottom: 0}}>
							D&apos;une trouvaille à votre étagère
						</h2>
					</div>

					{/* Une liste ordonnée, pas quatre blocs côte à côte : les quatre
					    étapes se suivent, et un lecteur d'écran doit l'entendre. */}
					<ol className={styles.etapes}>
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

			<section className={styles.section}>
				<div className={styles.appel}>
					<h2 className={styles.appelTitre}>Venez fouiller la caverne</h2>

					<p className={styles.appelTexte}>
						Neuf, occasion, box surprises et histoires de geek — il y a forcément une trouvaille pour
						vous.
					</p>

					<div className={styles.appelBoutons}>
						<Link href='/boutique' className={`btn btn-secondary ${styles.appelPrincipal}`}>
							Explorer la boutique
						</Link>
						<Link href='/contact' className={`btn btn-secondary ${styles.appelSecondaire}`}>
							Me contacter
						</Link>
					</div>
				</div>
			</section>
		</>
	);
}
