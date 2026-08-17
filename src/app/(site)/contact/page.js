import Link from 'next/link';
import {ChevronDown, Clock, Mail, Phone} from 'lucide-react';
import {SUJETS} from '@/server/services/contact';
import {getSettings} from '@/server/services/settings';
import {getModesLivraison} from '@/server/services/shipping';
import {formatPrix, formatPrixCompact} from '@/lib/format';
import ContactForm from './ContactForm';
import styles from './contact.module.css';

/* Contact et questions fréquentes.

   Les questions de livraison sont composées à partir de la base plutôt
   qu'écrites en dur : le jour où le client change de transporteur ou monte son
   franco de port depuis l'admin, la FAQ suit. Une réponse figée qui contredit
   le tunnel de commande est pire que pas de réponse du tout — c'est celle qui
   génère la réclamation.

   L'accordéon est un `<details>` natif. La maquette n'en ouvrait qu'un à la
   fois via un état React ; ici tout fonctionne sans JavaScript, la recherche du
   navigateur trouve le texte replié, et rien ne se ferme sous le doigt de
   quelqu'un qui compare deux réponses. */

export const metadata = {
	title: 'Contact et questions fréquentes',
	description:
		'Une question sur une pièce, une commande ou une box ? Écrivez au Vieux geek — il lit et répond lui-même.',
};

/// Décrit les modes de livraison actifs en une phrase, pour la FAQ.
function phraseLivraison(modes, francoParDefaut) {
	if (modes.length === 0) {
		return 'Les modes de livraison seront annoncés à l’ouverture de la boutique.';
	}

	const liste = modes
		.map((mode) => {
			const prix = mode.priceCents === 0 ? 'gratuit' : formatPrix(mode.priceCents);

			return `${mode.name} (${prix})`;
		})
		.join(', ');

	return `Au choix : ${liste}. La livraison est offerte à partir de ${francoParDefaut} d’achat.`;
}

export default async function Contact() {
	const [reglages, modes] = await Promise.all([getSettings(), getModesLivraison()]);

	const email = String(reglages['legal.email'] ?? '').trim();
	const telephone = String(reglages['legal.phone'] ?? '').trim();
	const franco = formatPrixCompact(reglages['shipping.freeAboveCents']);

	const infos = [
		email && {
			icone: Mail,
			titre: 'Par e-mail',
			texte: 'La voie la plus sûre pour une réponse détaillée.',
			lien: email,
			href: `mailto:${email}`,
		},
		telephone && {
			icone: Phone,
			titre: 'Par téléphone',
			texte: 'Du mardi au samedi, 10 h – 18 h.',
			lien: telephone,
			// Les espaces d'un numéro français ne passent pas dans un `tel:`.
			href: `tel:${telephone.replace(/\s/g, '')}`,
		},
		{
			icone: Clock,
			titre: 'Délai de réponse',
			texte: 'Je lis et réponds moi-même, en général sous 24 h ouvrées.',
		},
	].filter(Boolean);

	const questions = [
		{
			q: 'Quand la boutique ouvre-t-elle vraiment ?',
			r: 'J’inventorie et je photographie les dernières pièces. Inscrivez-vous à la lettre de l’antre pour être prévenu dès que le panier s’ouvre.',
		},
		{
			q: 'Neuf, occasion : comment faites-vous la différence ?',
			r: 'Chaque fiche l’indique clairement. Le neuf est sous blister d’origine. L’occasion est chinée, nettoyée, testée quand c’est un objet électronique, et l’état est décrit honnêtement avec de vraies photos.',
		},
		{
			q: 'Comment fonctionnent les box surprises ?',
			r: 'Vous choisissez un thème et une taille, je remplis le reste à la main : chaque box est une pioche différente, jamais deux fois la même. Le contenu exact de la vôtre est noté à la préparation, je peux vous le redire si vous me le demandez.',
		},
		{
			q: 'Quels sont les délais et modes de livraison ?',
			r: `Les commandes partent sous 48 h ouvrées. ${phraseLivraison(modes, franco)}`,
		},
		{
			q: 'Puis-je retourner un article ?',
			r: 'Oui, vous avez quatorze jours pour changer d’avis, sans avoir à vous justifier. L’article doit revenir complet et en état d’être revendu. Seules exceptions : les fichiers téléchargés et les jeux ou disques que vous avez descellés.',
		},
		{
			q: 'Est-ce que vous rachetez ou reprenez des pièces ?',
			r: 'Ça m’arrive. Si vous avez une collection ou une pièce à proposer, écrivez-moi avec le sujet « Une proposition de vente ou d’échange » et on en discute.',
		},
		{
			q: 'Le paiement est-il sécurisé ?',
			r: 'Oui. Carte bancaire ou PayPal, saisie chez le prestataire de paiement. Aucune coordonnée bancaire ne transite ni ne reste sur le serveur du site.',
		},
		{
			q: 'Peut-on précommander une pièce annoncée ?',
			r: 'Oui, les pièces marquées « Précommande » se réservent. Vous êtes prévenu dès qu’elles arrivent à l’atelier.',
		},
	];

	return (
		<>
			<section className={styles.intro}>
				<div className={styles.blob} aria-hidden='true' />

				<div className={styles.introContenu}>
					<span className={styles.kicker}>On papote ?</span>

					<h1 className={styles.titre}>Une question ? Écrivez au vieux geek</h1>

					<p className={styles.chapeau}>
						Un doute sur une pièce, une commande, une box à composer, ou juste l&apos;envie de parler
						mécha : je lis tout et je réponds moi-même, en général sous 24 h.
					</p>
				</div>
			</section>

			<section className={styles.section}>
				<div className={styles.colonnes}>
					<div className={styles.carteFormulaire}>
						<ContactForm sujets={SUJETS} />
					</div>

					<div className={styles.infos}>
						{infos.map((info) => {
							const Icone = info.icone;

							return (
								<div key={info.titre} className={styles.info}>
									<span className={styles.infoIcone} aria-hidden='true'>
										<Icone size={20} strokeWidth={2.75} />
									</span>

									<div>
										<h2 className={styles.infoTitre}>{info.titre}</h2>
										<p className={styles.infoTexte}>{info.texte}</p>

										{info.href && (
											<a href={info.href} className={styles.infoLien}>
												{info.lien}
											</a>
										)}
									</div>
								</div>
							);
						})}

						<div className={styles.encart}>
							<h2 className={styles.encartTitre}>L&apos;atelier</h2>
							<p className={styles.encartTexte}>
								Boutique en ligne, préparée à la main. Retrait des commandes possible sur rendez-vous —
								écrivez-moi, on cale un créneau.
							</p>
						</div>
					</div>
				</div>
			</section>

			<section id='faq' className={styles.faq}>
				<div className={styles.faqContenu}>
					<div className={styles.faqEntete}>
						<span className={styles.kicker}>Questions fréquentes</span>
						<h2 className={styles.faqTitre}>Ce qu&apos;on me demande le plus souvent</h2>
					</div>

					<div className={styles.faqListe}>
						{questions.map((question) => (
							<details key={question.q} className={styles.question}>
								<summary className={styles.questionTitre}>
									<span className={styles.questionTexte}>{question.q}</span>
									<span className={styles.caret} aria-hidden='true'>
										<ChevronDown size={20} strokeWidth={2.75} />
									</span>
								</summary>

								<p className={styles.reponse}>{question.r}</p>
							</details>
						))}
					</div>

					<div className={styles.faqPied}>
						<p>Vous ne trouvez pas votre réponse ?</p>
						<p className={styles.faqPiedDetail}>
							Écrivez-moi via le formulaire ci-dessus — je réponds à tout le monde. Les{' '}
							<Link href='/legal#cgv'>conditions de vente</Link> détaillent le reste.
						</p>
					</div>
				</div>
			</section>
		</>
	);
}
