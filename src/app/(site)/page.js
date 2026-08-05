import Link from 'next/link';
import Image from 'next/image';
import {ArrowRight, MapPin, ShieldCheck, Truck} from 'lucide-react';
import {getRayons} from '@/server/services/categories';
import {getSettings} from '@/server/services/settings';
import {listProducts} from '@/server/services/products';
import {getLatestPosts} from '@/server/services/posts';
import {formatDate, formatPrixCompact} from '@/lib/format';
import ProductCard from '@/components/ProductCard/ProductCard';
import NewsletterForm from '@/components/NewsletterForm/NewsletterForm';
import styles from './accueil.module.css';

/* L'accueil — la vitrine.

   Elle n'a aucun état : tout vient de la base, en une passe de Server Component.
   Seuls les deux formulaires d'inscription sont des îlots client.

   Les sections tiennent compte de ce qui existe réellement : l'aperçu du blog
   ne s'affiche que s'il y a des articles publiés, les trouvailles que si le
   catalogue est garni. Une section vide sur une page d'accueil fait plus de mal
   qu'une section absente. */

export const metadata = {
	title: "L'antre du vieux geek fou — Figurines, mangas, jeux et trouvailles",
	description:
		'Boutique indépendante de pop culture : figurines, mangas, jeux de société, JDR, goodies et box surprises. Neuf et occasion chinée avec soin, expédié depuis la France.',
};

const REASSURANCES = [
	{
		Icone: Truck,
		titre: 'Livraison offerte dès {seuil}',
		sous: 'En France métropolitaine',
	},
	{
		Icone: MapPin,
		titre: 'Point relais Mondial Relay',
		sous: 'Ou à domicile avec Colissimo',
	},
	{
		Icone: ShieldCheck,
		titre: 'Paiement 100 % sécurisé',
		/* `{moyens}` suit le réglage, comme `{seuil}` suit le franco de port :
		   promettre PayPal dès l'accueil alors que le tunnel ne le propose pas
		   ferait découvrir l'absence au moment de payer. */
		sous: '{moyens}, chiffré',
	},
];

const TAILLES_BOX = [
	{label: 'S', desc: '3–4 pièces', prix: '25 €'},
	{label: 'M', desc: '5–7 pièces', prix: '40 €'},
	{label: 'L', desc: '8–10 pièces', prix: '60 €'},
];

const THEMES_BOX = ['Manga', 'Rétro-gaming', 'Horreur', 'Mystère total'];

/* Les rayons alternent les deux rampes de couleur — la sauge est une seconde
   voix du design, pas un simple rehaut. Même règle que dans le header. */
function fondRayon(index) {
	return index % 2 === 0 ? 'var(--color-accent-100)' : 'var(--color-accent-2-100)';
}

export default async function Accueil() {
	const [rayons, reglages, produits, articles] = await Promise.all([
		getRayons(),
		getSettings(),
		listProducts(),
		getLatestPosts(3),
	]);

	const boutiqueOuverte = Boolean(reglages['shop.open']);
	const seuilFranco = formatPrixCompact(reglages['shipping.freeAboveCents']);
	const moyensPaiement = reglages['payment.paypalEnabled'] ? 'CB & PayPal' : 'CB';
	const trouvailles = produits.slice(0, 4);

	return (
		<>
			{/* — HERO — */}
			<section className={styles.hero}>
				<div className={`${styles.blob} ${styles.blobHaut}`} aria-hidden='true' />
				<div className={`${styles.blob} ${styles.blobBas}`} aria-hidden='true' />

				<div className={styles.heroContenu}>
					<div>
						<span className='tag tag-outline' style={{marginBottom: 20}}>
							Boutique indépendante · Neuf &amp; occasion
						</span>

						<h1 className={styles.heroTitre}>
							Poussez la porte
							<br />
							de l&apos;antre.
						</h1>

						<p className={styles.heroTexte}>
							Ici, un vieux geek un peu fou entasse figurines, mangas, jeux et
							trouvailles de la pop culture — du neuf, de l&apos;occasion chinée avec
							soin, et des box surprises préparées à la main. Installez-vous : la
							caverne est à vous.
						</p>

						<div className={styles.heroBoutons}>
							<Link
								href='/boutique'
								className='btn btn-primary'
								style={{padding: '12px 22px', fontSize: 15}}>
								Fouiller les rayons
							</Link>
							<Link
								href='/blog'
								className='btn btn-secondary'
								style={{padding: '12px 22px', fontSize: 15}}>
								Lire le blog
							</Link>
						</div>
					</div>

					{/* La photo de l'antre viendra du client. En attendant, l'emplacement
					    garde sa place dans la mise en page plutôt que de la voir se
					    réorganiser le jour de la livraison des visuels. */}
					<figure className={styles.heroVisuel}>
						<span className={styles.emplacement}>
							Photo : l&apos;antre, ses étagères et ses trésors
						</span>
					</figure>
				</div>
			</section>

			{/* — RÉASSURANCE — */}
			<section className={styles.reassuranceSection}>
				<div className={styles.reassurances}>
					{REASSURANCES.map(({Icone, titre, sous}) => (
						<div key={titre} className={styles.reassurance}>
							<span className={styles.reassuranceIcone}>
								<Icone size={22} strokeWidth={2.75} />
							</span>
							<div>
								<div className={styles.reassuranceTitre}>
									{titre.replace('{seuil}', seuilFranco)}
								</div>
								<div className={styles.reassuranceSous}>
									{sous.replace('{moyens}', moyensPaiement)}
								</div>
							</div>
						</div>
					))}
				</div>
			</section>

			{/* — RAYONS — */}
			<section id='rayons' className={styles.section}>
				<div className={styles.enTete}>
					<div>
						<span className={styles.kicker}>Fouiller par rayon</span>
						<h2 className={styles.titreSection}>Chaque étagère a son univers</h2>
					</div>
					<Link href='/boutique' className={styles.lienSection}>
						Tout voir →
					</Link>
				</div>

				<div className={styles.rayons}>
					{rayons.map((rayon, index) => (
						<Link
							key={rayon.id}
							href={`/boutique?rayon=${rayon.slug}`}
							className={styles.rayon}
							style={{background: fondRayon(index)}}>
							<div className={styles.rayonVisuel}>
								{rayon.imageUrl ? (
									<Image
										src={rayon.imageUrl}
										alt=''
										fill
										sizes='(max-width: 560px) 100vw, (max-width: 900px) 50vw, 360px'
										className={`${styles.rayonImage} washed`}
									/>
								) : (
									<span className={styles.emplacementPetit}>{rayon.name}</span>
								)}
							</div>

							<div className={styles.rayonCorps}>
								<div style={{flex: 1}}>
									<h3 className={styles.rayonNom}>{rayon.name}</h3>
									{rayon.description && (
										<p className={styles.rayonMeta}>{rayon.description}</p>
									)}
								</div>
								<span className={styles.rayonFleche} aria-hidden='true'>
									<ArrowRight size={17} strokeWidth={2.75} />
								</span>
							</div>
						</Link>
					))}
				</div>
			</section>

			{/* — TROUVAILLES — */}
			{trouvailles.length > 0 && (
				<section id='trouvailles' className={styles.bandeSurface}>
					<div className={styles.section}>
						<div>
							{!boutiqueOuverte && (
								<span className='tag tag-accent' style={{marginBottom: 12}}>
									Boutique en construction
								</span>
							)}
							<h2 className={styles.titreSection}>Les premières trouvailles</h2>
						</div>

						<p className={styles.chapeauSection}>
							Les étagères ne sont pas encore toutes garnies : j&apos;inventorie, je
							photographie et je bichonne chaque pièce. Voici un avant-goût de ce qui
							vous attend à l&apos;ouverture.
						</p>

						<div className={styles.produits}>
							{trouvailles.map((produit) => (
								<ProductCard
									key={produit.id}
									produit={produit}
									boutiqueOuverte={boutiqueOuverte}
								/>
							))}
						</div>

						{!boutiqueOuverte && (
							<div className={styles.bandeauInscription}>
								<p className={styles.bandeauTexte}>
									<strong className={styles.bandeauFort}>
										La boutique est en construction.
									</strong>{' '}
									Laissez votre e-mail, je vous préviens dès l&apos;ouverture — et les
									premiers inscrits ont une surprise.
								</p>

								<NewsletterForm source='accueil-trouvailles' />
							</div>
						)}
					</div>
				</section>
			)}

			{/* — BOX SURPRISE — */}
			<section id='box' className={styles.section}>
				<div className={styles.box}>
					<div>
						<span className={styles.kickerSauge}>Préparée à la main</span>
						<h2 className={styles.titreBox}>La box surprise</h2>

						<p className={styles.boxTexte}>
							Choisissez un thème et une taille, je remplis le reste à la main. Chaque
							box est une pioche différente — jamais deux fois la même caverne.
						</p>

						<div className={styles.boxLabel}>Un thème</div>
						<div className={styles.boxThemes}>
							{THEMES_BOX.map((theme) => (
								<span key={theme} className='tag tag-neutral'>
									{theme}
								</span>
							))}
						</div>

						<div className={styles.boxLabel}>Une taille</div>
						<div className={styles.boxTailles}>
							{TAILLES_BOX.map((taille) => (
								<div key={taille.label} className={styles.boxTaille}>
									<div className={styles.boxTailleNom}>{taille.label}</div>
									<div className={styles.boxTailleDesc}>{taille.desc}</div>
									<div className={styles.boxTaillePrix}>{taille.prix}</div>
								</div>
							))}
						</div>

						<Link
							href='/box'
							className='btn btn-primary'
							style={{padding: '12px 24px', fontSize: 15}}>
							Composer ma box
						</Link>
					</div>

					<figure className={styles.boxVisuel}>
						<span className={styles.emplacement}>Photo : une box surprise ouverte</span>
					</figure>
				</div>
			</section>

			{/* — BLOG — */}
			{articles.length > 0 && (
				<section id='blog' className={styles.sectionBlog}>
					<div className={styles.enTete}>
						<div>
							<span className={styles.kicker}>Le blog de l&apos;antre</span>
							<h2 className={styles.titreSection}>
								Des histoires de geek, servies chaudes
							</h2>
						</div>
						<Link href='/blog' className={styles.lienSection}>
							Tous les articles →
						</Link>
					</div>

					<div className={styles.articles}>
						{articles.map((article) => (
							<Link
								key={article.id}
								href={`/blog/${article.slug}`}
								className={styles.article}>
								<div className={styles.articleVisuel}>
									{article.image ? (
										<Image
											src={article.image}
											alt=''
											fill
											sizes='(max-width: 560px) 100vw, (max-width: 900px) 50vw, 360px'
											className={`${styles.articleImage} washed`}
										/>
									) : (
										<span className={styles.emplacementPetit}>{article.titre}</span>
									)}
								</div>

								{article.categorie && (
									<span
										className='tag tag-accent-2'
										style={{alignSelf: 'flex-start', marginBottom: 11}}>
										{article.categorie}
									</span>
								)}

								<h3 className={styles.articleTitre}>{article.titre}</h3>
								{article.chapeau && (
									<p className={styles.articleChapeau}>{article.chapeau}</p>
								)}
								<span className={styles.articleMeta}>{formatDate(article.date)}</span>
							</Link>
						))}
					</div>
				</section>
			)}

			{/* — L'ANTRE — */}
			<section id='antre' className={styles.bandeSurface}>
				<div className={styles.antre}>
					<figure className={styles.antreVisuel}>
						<span className={styles.emplacement}>
							Photo : le vieux geek dans son antre
						</span>
					</figure>

					<div>
						<span className={styles.kicker}>Qui est ce vieux geek ?</span>
						<h2 className={styles.titreSection}>
							Une caverne montée pièce&nbsp;par&nbsp;pièce, par passion
						</h2>

						<p className={styles.antreTexte}>
							Je collectionne, je chine, je répare et j&apos;écris sur cette culture qui
							m&apos;accompagne depuis toujours. L&apos;antre, c&apos;est mon comptoir :
							des pièces choisies une à une, du neuf comme de l&apos;occasion soignée, et
							des ouvrages que je crée moi-même.
						</p>

						<p className={styles.antreTexte}>
							Pas d&apos;algorithme, pas de rayon sans âme — juste un vieux geek un peu
							fou qui aime partager ses trouvailles.
						</p>

						<Link
							href='/a-propos'
							className='btn btn-secondary'
							style={{padding: '12px 24px', fontSize: 15, marginTop: 10}}>
							Toute l&apos;histoire →
						</Link>
					</div>
				</div>
			</section>

			{/* — NEWSLETTER —
			    L'ancre #newsletter est visée depuis la boutique et le footer : la
			    déplacer casserait ces liens. */}
			<section id='newsletter' className={styles.section}>
				<div className={styles.lettre}>
					<div className={`${styles.blob} ${styles.blobLettre}`} aria-hidden='true' />

					<div className={styles.lettreContenu}>
						<h2 className={styles.lettreTitre}>
							{boutiqueOuverte ? "La lettre de l'antre" : "Ne ratez pas l'ouverture"}
						</h2>

						<p className={styles.lettreTexte}>
							Nouveautés, précommandes, box du mois et coups de cœur du blog — une
							lettre de l&apos;antre, sans spam, quand il y a vraiment quelque chose à
							raconter.
						</p>

						<NewsletterForm
							source='accueil-lettre'
							libelle="S'inscrire"
							variante='accent'
						/>

						<p className={styles.lettreMention}>
							En vous inscrivant, vous acceptez de recevoir mes e-mails. Désinscription
							en un clic, à tout moment.
						</p>
					</div>
				</div>
			</section>
		</>
	);
}
