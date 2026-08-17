import NewsletterForm from '@/components/NewsletterForm/NewsletterForm';
import styles from './ichiban.module.css';

/* L'Ichiban Kuji.

   Une page d'annonce, pas une loterie. Le tirage n'est pas construit — c'est
   une décision, pas un oubli : c'est la partie la plus lourde du projet, elle
   suppose des séries, des lots, des tickets numérotés, un tirage vérifiable et
   des obligations légales propres aux loteries payantes. Elle attend d'ailleurs
   toujours la réponse du client (voir docs/QUESTIONS-CLIENT.md, point 12).

   La maquette proposait un tirage de démonstration. Il n'est volontairement pas
   repris : un tirage simulé sur la page d'une loterie payante, même annoncé
   comme une démo, se retient comme une promesse — et il n'y a rien à gagner à
   ce qu'un visiteur croie avoir tiré un lot.

   Cette page a donc un seul travail, qu'elle fait entièrement : expliquer le
   principe, dire honnêtement que ce n'est pas encore ouvert, et proposer d'être
   prévenu. Les liens de l'en-tête et du pied de page mènent enfin quelque part. */

export const metadata = {
	title: 'L’Ichiban Kuji',
	description:
		'Un ticket, un lot garanti. Le principe de la loterie japonaise, et où en est sa préparation dans l’antre.',
};

const RANGS = [
	{
		lettre: 'A',
		titre: 'Les pièces maîtresses',
		texte: 'Les grandes figurines, celles qu’on met en évidence. Peu nombreuses par série.',
	},
	{
		lettre: 'B',
		titre: 'Les belles pièces',
		texte: 'Figurines plus petites, statuettes, objets de collection à part entière.',
	},
	{
		lettre: 'C',
		titre: 'Les objets du quotidien',
		texte: 'Mugs, tapis de souris, textiles — ce qui sert vraiment et qu’on garde longtemps.',
	},
	{
		lettre: 'D',
		titre: 'Les petites trouvailles',
		texte: 'Porte-clés, badges, serviettes. Le rang le plus fourni, jamais le plus décevant.',
	},
	{
		lettre: 'E',
		titre: 'Les illustrations',
		texte: 'Cartes, marque-pages, planches imprimées. De quoi compléter une collection.',
	},
	{
		lettre: 'Dernier lot',
		derniere: true,
		titre: 'Le Dernier lot',
		texte: 'Réservé au tout dernier ticket de la série. Une pièce unique, qu’aucun autre rang ne propose.',
	},
];

const ETAPES = [
	{
		titre: 'Vous choisissez une série',
		texte: 'Chaque série a ses propres lots, en édition limitée et en quantité fixe annoncée d’avance.',
	},
	{
		titre: 'Vous tirez un ticket',
		texte: 'Un ticket donne un lot, toujours. C’est le tirage qui décide de son rang, pas la mise.',
	},
	{
		titre: 'Vous repartez gagnant',
		texte: 'Il n’y a pas de perdant. Et le tout dernier ticket de la série remporte le Dernier lot.',
	},
];

export default function IchibanKuji() {
	return (
		<>
			<section className={styles.intro}>
				<div className={styles.blob} aria-hidden='true' />

				<div className={styles.introContenu}>
					<span className='tag tag-accent' style={{marginBottom: 14}}>
						Ichiban Kuji · 一番くじ
					</span>

					<h1 className={styles.titre}>La loterie où l&apos;on gagne à tous les coups</h1>

					<p className={styles.chapeau}>
						Un ticket, un lot garanti. Chaque tirage donne un lot d&apos;un rang — A, B, C… —
						jusqu&apos;au fameux Dernier lot, réservé au tout dernier ticket. Pas de perdant, rien que
						des trouvailles.
					</p>
				</div>
			</section>

			<section className={styles.section}>
				<div className={styles.attente}>
					<div className={styles.attenteIntro}>
						<h2 className={styles.attenteTitre}>Pas encore ouvert — et je préfère le dire</h2>
						<p className={styles.attenteTexte}>
							Monter un Ichiban Kuji honnête demande des séries complètes, des tickets numérotés et un
							tirage dont personne ne puisse douter. Je m&apos;y attelle une fois la boutique bien en
							place. Laissez votre adresse : vous serez prévenu de la première série, avant tout le
							monde.
						</p>
					</div>

					<div className={styles.attenteFormulaire}>
						<NewsletterForm source='ichiban-kuji' libelle='Être prévenu' />
					</div>
				</div>
			</section>

			<section className={styles.etapes}>
				<div className={styles.etapesContenu}>
					<h2 className={styles.titreSection}>Comment ça marchera</h2>

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

			<section className={styles.section}>
				<h2 className={styles.titreSection}>Les rangs de lots</h2>

				<ul className={styles.rangs}>
					{RANGS.map((rang) => (
						<li key={rang.lettre} className={styles.rang}>
							<span
								className={`${styles.lettre} ${rang.derniere ? styles.lettreDerniere : ''}`}
								aria-hidden='true'>
								{rang.lettre}
							</span>

							<div>
								<h3 className={styles.rangTitre}>{rang.titre}</h3>
								<p className={styles.rangTexte}>{rang.texte}</p>
							</div>
						</li>
					))}
				</ul>
			</section>
		</>
	);
}
