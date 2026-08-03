'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {ChevronDown, Menu, Search, ShoppingCart, Ticket, X} from 'lucide-react';
import styles from './SiteHeader.module.css';

/* Header de la vitrine.

   Le composant est entièrement client parce que ses trois zones interactives —
   burger de la barre principale, menus déroulants de la sous-barre, panneau
   mobile — partagent le même état d'ouverture tout en vivant à des endroits
   différents du DOM. Les découper imposerait un contexte pour un gain nul : le
   balisage statique qui les entoure ne pèse presque rien.

   Les données (rayons, texte du bandeau) sont lues en base par SiteHeader, le
   composant serveur parent, et arrivent ici en props. Ce fichier ne touche
   jamais Prisma : son code part au navigateur.

   Le design impose stroke-width 2.75 sur toutes les icônes Lucide. */

const TROUVAILLES = [
	{nom: 'Nouveautés', meta: 'Les dernières arrivées', href: '/boutique?tri=nouveautes'},
	{nom: 'Précommandes', meta: 'Réservez avant tout le monde', href: '/boutique?etat=precommande'},
	{nom: 'Occasions contrôlées', meta: 'Chinées et vérifiées', href: '/boutique?etat=occasion'},
	{nom: 'Pièces neuves', meta: 'Sous blister', href: '/boutique?etat=neuf'},
	{nom: 'Ouvrages du geek', meta: 'Créations numériques', href: '/boutique?rayon=ouvrages-du-geek'},
];

const THEMES_BOX = ['Manga', 'Rétro-gaming', 'Horreur', 'Mystère total'];

const TAILLES_BOX = [
	{nom: 'S', prix: '25 €'},
	{nom: 'M', prix: '40 €'},
	{nom: 'L', prix: '60 €'},
];

/* Les pastilles alternent entre les deux rampes : la sauge est une seconde voix
   à part entière dans ce design, pas un simple accent secondaire. */
function couleurPastille(index) {
	return index % 2 === 0 ? 'var(--color-accent-100)' : 'var(--color-accent-2-100)';
}

export default function HeaderClient({
	rayons,
	annonce,
	articlesAuPanier = 0,
	compte = null,
}) {
	const [menuOuvert, setMenuOuvert] = useState(null);
	const [mobileOuvert, setMobileOuvert] = useState(false);

	/* L'entrée de nav en cours se déduit du chemin plutôt que de descendre en
	   prop depuis chaque page : une page qui oublierait de la passer n'aurait
	   silencieusement aucun onglet actif. `startsWith` pour que /produit/x
	   surligne bien « Boutique ». */
	const chemin = usePathname();
	const estActif = (prefixes) => prefixes.some((prefixe) => chemin.startsWith(prefixe));

	const fermerMenu = () => setMenuOuvert(null);
	const fermerMobile = () => setMobileOuvert(false);

	const basculer = (nom) => setMenuOuvert((actuel) => (actuel === nom ? null : nom));

	/* Échap referme ce qui est ouvert. Sans ça, un utilisateur au clavier qui
	   ouvre un menu n'a aucun moyen d'en sortir sans le parcourir entièrement. */
	useEffect(() => {
		if (!menuOuvert && !mobileOuvert) return undefined;

		const surTouche = (evenement) => {
			if (evenement.key === 'Escape') {
				fermerMenu();
				fermerMobile();
			}
		};

		document.addEventListener('keydown', surTouche);
		return () => document.removeEventListener('keydown', surTouche);
	}, [menuOuvert, mobileOuvert]);

	const caret = (nom) =>
		`${styles.caret} ${menuOuvert === nom ? styles.caretOuvert : ''}`;

	return (
		<header className={styles.header}>
			{annonce && (
				<div className={styles.annonce}>
					<div className={styles.annonceContenu}>{annonce}</div>
				</div>
			)}

			<div className={styles.barre}>
				<Link href='/' className={styles.wordmark}>
					<span className={styles.wordmarkHaut}>L&apos;antre du</span>
					<span className={styles.wordmarkBas}>vieux geek fou</span>
				</Link>

				<nav className={styles.nav}>
					<Link href='/boutique' data-actif={estActif(['/boutique', '/produit'])}>
						Boutique
					</Link>
					<Link href='/blog' data-actif={estActif(['/blog'])}>
						Blog
					</Link>
					{/* Connecté, l'entrée porte le prénom et une pastille à l'initiale :
					    l'état de connexion doit se lire d'un coup d'œil, sans avoir à
					    ouvrir la page. */}
					<Link
						href='/compte'
						data-actif={estActif(['/compte'])}
						className={compte ? styles.lienCompte : undefined}>
						{compte ? (
							<>
								<span className={styles.avatarNav} aria-hidden='true'>
									{compte.initiale}
								</span>
								{compte.prenom ?? 'Mon compte'}
							</>
						) : (
							'Compte'
						)}
					</Link>
				</nav>

				<div className={styles.actions}>
					<button
						type='button'
						onClick={() => {
							setMobileOuvert((ouvert) => !ouvert);
							fermerMenu();
						}}
						className={`btn btn-secondary btn-icon ${styles.burger}`}
						aria-label={mobileOuvert ? 'Fermer le menu' : 'Ouvrir le menu'}
						aria-expanded={mobileOuvert}>
						{mobileOuvert ? (
							<X size={20} strokeWidth={2.75} />
						) : (
							<Menu size={20} strokeWidth={2.75} />
						)}
					</button>

					<Link
						href='/recherche'
						className='btn btn-secondary btn-icon'
						aria-label='Rechercher'>
						<Search size={18} strokeWidth={2.75} />
					</Link>

					{/* Le compteur est dans le libellé accessible plutôt qu'en simple
					    pastille : « Panier, 3 articles » se comprend à l'oreille,
					    « Panier 3 » non. */}
					<Link
						href='/panier'
						className='btn btn-primary'
						style={{gap: 8}}
						aria-label={
							articlesAuPanier > 0
								? `Panier, ${articlesAuPanier} article${articlesAuPanier > 1 ? 's' : ''}`
								: 'Panier, vide'
						}>
						<ShoppingCart size={18} strokeWidth={2.75} />
						<span className={styles.panierLibelle}>Panier</span>
						{articlesAuPanier > 0 && (
							<span className={styles.pastillePanier} aria-hidden='true'>
								{articlesAuPanier}
							</span>
						)}
					</Link>
				</div>
			</div>

			{mobileOuvert && (
				<div className={styles.mobile}>
					<nav className={styles.mobileNav}>
						<Link href='/boutique' onClick={fermerMobile}>
							Boutique
						</Link>
						<Link href='/blog' onClick={fermerMobile}>
							Blog
						</Link>
						<Link href='/compte' onClick={fermerMobile}>
							{compte ? (compte.prenom ? `Mon compte (${compte.prenom})` : 'Mon compte') : 'Compte'}
						</Link>
						<Link href='/panier' onClick={fermerMobile} className={styles.mobilePanier}>
							Panier
						</Link>
						<Link href='/ichiban-kuji' onClick={fermerMobile}>
							Ichiban Kuji
						</Link>
					</nav>

					<div className={styles.mobileTitre}>Rayons</div>
					<div className={styles.mobileRayons}>
						{rayons.map((rayon, index) => (
							<Link
								key={rayon.id}
								href={`/boutique?rayon=${rayon.slug}`}
								onClick={fermerMobile}>
								<span
									className={styles.mobilePastille}
									style={{background: couleurPastille(index)}}
								/>
								{rayon.name}
							</Link>
						))}
					</div>

					<Link href='/box' onClick={fermerMobile} className={styles.mobileBox}>
						Composer une box surprise →
					</Link>
				</div>
			)}

			<div className={styles.sousBarre}>
				<div className={styles.sousBarreContenu}>
					<Link href='/ichiban-kuji' className={styles.lienIchiban}>
						<Ticket size={15} strokeWidth={2.75} />
						Ichiban Kuji
					</Link>

					<div className={styles.menu}>
						<button
							type='button'
							onClick={() => basculer('rayons')}
							className={styles.declencheur}
							aria-expanded={menuOuvert === 'rayons'}
							aria-haspopup='true'>
							Rayons
							<ChevronDown size={15} strokeWidth={2.75} className={caret('rayons')} />
						</button>

						{menuOuvert === 'rayons' && (
							<div className={`${styles.panneau} ${styles.panneauRayons}`}>
								{rayons.map((rayon, index) => (
									<Link
										key={rayon.id}
										href={`/boutique?rayon=${rayon.slug}`}
										onClick={fermerMenu}
										className={styles.entree}>
										<span
											className={styles.pastille}
											style={{background: couleurPastille(index)}}
										/>
										<span style={{minWidth: 0}}>
											<span className={styles.entreeNom}>{rayon.name}</span>
											<span className={styles.entreeMeta}>{rayon.description}</span>
										</span>
									</Link>
								))}
							</div>
						)}
					</div>

					<div className={styles.menu}>
						<button
							type='button'
							onClick={() => basculer('trouvailles')}
							className={styles.declencheur}
							aria-expanded={menuOuvert === 'trouvailles'}
							aria-haspopup='true'>
							Trouvailles
							<ChevronDown
								size={15}
								strokeWidth={2.75}
								className={caret('trouvailles')}
							/>
						</button>

						{menuOuvert === 'trouvailles' && (
							<div className={`${styles.panneau} ${styles.panneauListe}`}>
								{TROUVAILLES.map((entree) => (
									<Link
										key={entree.nom}
										href={entree.href}
										onClick={fermerMenu}
										className={styles.entreeSimple}>
										<span className={styles.entreeNom}>{entree.nom}</span>
										<span className={styles.entreeMeta}>{entree.meta}</span>
									</Link>
								))}
							</div>
						)}
					</div>

					<div className={styles.menu}>
						<button
							type='button'
							onClick={() => basculer('box')}
							className={styles.declencheur}
							aria-expanded={menuOuvert === 'box'}
							aria-haspopup='true'>
							Box surprise
							<ChevronDown size={15} strokeWidth={2.75} className={caret('box')} />
						</button>

						{menuOuvert === 'box' && (
							<div className={`${styles.panneau} ${styles.panneauBox}`}>
								<div className={styles.sousTitre}>Par thème</div>
								<div className={styles.themes}>
									{THEMES_BOX.map((theme) => (
										<Link
											key={theme}
											href={`/box?theme=${encodeURIComponent(theme.toLowerCase())}`}
											onClick={fermerMenu}
											className='tag tag-neutral'>
											{theme}
										</Link>
									))}
								</div>

								<div className={styles.sousTitre}>Par taille</div>
								<div className={styles.tailles}>
									{TAILLES_BOX.map((taille) => (
										<Link
											key={taille.nom}
											href={`/box?taille=${taille.nom.toLowerCase()}`}
											onClick={fermerMenu}
											className={styles.taille}>
											<span className={styles.tailleNom}>{taille.nom}</span>
											<span className={styles.taillePrix}>{taille.prix}</span>
										</Link>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{menuOuvert && (
				<div
					className={styles.captureClic}
					onClick={fermerMenu}
					aria-hidden='true'
				/>
			)}
		</header>
	);
}
