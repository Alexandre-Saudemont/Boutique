import Link from 'next/link';
import {getSettings} from '@/server/services/settings';
import {formatPrixCompact} from '@/lib/format';
import styles from './legal.module.css';

/* Les pages légales.

   La maquette n'en montrait qu'une section à la fois, choisie par un état
   React. Ici les quatre sont empilées et ancrées : le lien `/legal#cgv` du
   pied de page fonctionne sans JavaScript, la page s'imprime d'un bloc, et un
   client qui cherche « rétractation » le trouve avec Ctrl+F. C'est aussi ce
   qui permet d'archiver la page telle qu'elle était le jour d'une commande —
   ce qu'un juge demandera avant toute chose en cas de litige.

   Les coordonnées viennent des réglages : elles changent (déménagement,
   changement d'hébergeur) sans qu'on redéploie. Tant qu'une case est vide,
   `Coordonnee` affiche un marqueur voyant plutôt qu'un texte inventé. */

export const metadata = {
	title: 'Informations légales',
	description:
		'Mentions légales, conditions générales de vente, politique de confidentialité et gestion des cookies.',
};

const SOMMAIRE = [
	{id: 'mentions', libelle: 'Mentions légales'},
	{id: 'cgv', libelle: 'CGV'},
	{id: 'confidentialite', libelle: 'Confidentialité'},
	{id: 'cookies', libelle: 'Gestion des cookies'},
];

/* Les cookies réellement posés par le site, et rien d'autre.

   La liste est tenue à la main, en regard de `src/server/auth/` : quatre
   cookies, tous strictement nécessaires, aucun traceur ni tiers. C'est ce qui
   dispense d'un bandeau de consentement (art. 82 de la loi Informatique et
   Libertés). Ajouter une mesure d'audience ou un pixel publicitaire fait
   tomber cette dispense — il faudra alors un vrai bandeau, pas une ligne de
   plus dans ce tableau. */
const COOKIES = [
	{
		nom: 'session',
		role: 'Vous garde connecté à votre compte d’une page à l’autre.',
		duree: '30 jours',
	},
	{
		nom: 'panier',
		role: 'Rattache votre panier à votre visite quand vous n’avez pas de compte.',
		duree: '30 jours',
	},
	{
		nom: 'commande',
		role: 'Retient le mode de livraison et l’adresse pendant que vous commandez.',
		duree: '4 heures',
	},
	{
		nom: 'promo',
		role: 'Retient le code de réduction saisi jusqu’à la validation du panier.',
		duree: '24 heures',
	},
];

/// Une coordonnée légale, ou un marqueur s'il manque encore. Voir `legal.module.css`.
function Coordonnee({valeur, quoi}) {
	const texte = String(valeur ?? '').trim();

	if (!texte) return <span className={styles.aCompleter}>{quoi} à compléter</span>;

	return texte;
}

export default async function Legal() {
	const reglages = await getSettings();

	const francoPort = formatPrixCompact(reglages['shipping.freeAboveCents']);
	const enFranchise = reglages['vat.regime'] === 'FRANCHISE';

	return (
		<>
			<section className={styles.entete}>
				<span className={styles.kicker}>Informations légales</span>
				<h1 className={styles.titre}>Les petites lignes de l&apos;antre</h1>
			</section>

			<div className={styles.grille}>
				<aside className={styles.sommaire} aria-label='Sommaire'>
					{SOMMAIRE.map((entree) => (
						<Link key={entree.id} href={`#${entree.id}`} className={styles.lienSommaire}>
							{entree.libelle}
						</Link>
					))}
				</aside>

				<div className={styles.prose}>
					<section id='mentions' className={styles.section}>
						<h2 className={styles.sectionTitre}>Mentions légales</h2>

						<h3>Éditeur du site</h3>
						<p>
							Ce site est édité par <Coordonnee valeur={reglages['legal.companyName']} quoi='Raison sociale' />,{' '}
							<Coordonnee valeur={reglages['legal.legalForm']} quoi='Forme juridique' />, dont le siège est
							situé <Coordonnee valeur={reglages['legal.address']} quoi='Adresse' />.
						</p>
						<p>
							SIRET : <Coordonnee valeur={reglages['legal.siret']} quoi='SIRET' />. Directeur de la
							publication : <Coordonnee valeur={reglages['legal.publisher']} quoi='Nom du responsable' />.
						</p>
						<p>
							Nous écrire : <Coordonnee valeur={reglages['legal.email']} quoi='Adresse e-mail' /> —{' '}
							<Coordonnee valeur={reglages['legal.phone']} quoi='Téléphone' />.
						</p>

						<h3>Hébergement</h3>
						<p>
							Le site est hébergé par <Coordonnee valeur={reglages['legal.host']} quoi='Hébergeur' />.
						</p>

						<h3>Propriété intellectuelle</h3>
						<p>
							Les textes, photographies et éléments graphiques de ce site sont, sauf mention contraire, la
							propriété de l&apos;éditeur. Les marques, logos et visuels des œuvres et produits présentés
							restent la propriété de leurs détenteurs respectifs et n&apos;apparaissent ici qu&apos;à des
							fins de description des articles proposés à la vente.
						</p>

						<h3>Responsabilité</h3>
						<p>
							Nous mettons tout en œuvre pour que les informations publiées soient exactes et à jour, sans
							pouvoir le garantir. Les photographies des articles d&apos;occasion sont prises pièce par
							pièce ; pour les articles neufs, le visuel peut différer légèrement du produit livré selon
							les éditions.
						</p>
					</section>

					<section id='cgv' className={styles.section}>
						<h2 className={styles.sectionTitre}>Conditions générales de vente</h2>
						<p className={styles.maj}>
							Ce document engage l&apos;éditeur comme l&apos;acheteur. Il doit être relu par un juriste
							avant l&apos;ouverture de la boutique.
						</p>

						<h3>Article 1 — Objet</h3>
						<p>
							Les présentes conditions régissent les ventes conclues sur ce site entre l&apos;éditeur et
							tout acheteur. Passer une commande vaut acceptation pleine et entière des conditions en
							vigueur ce jour-là.
						</p>

						<h3>Article 2 — Prix</h3>
						<p>
							Les prix sont indiqués en euros, hors frais de livraison, et s&apos;entendent au tarif
							affiché au moment de la commande.{' '}
							{enFranchise
								? 'TVA non applicable, article 293 B du code général des impôts.'
								: 'Les prix affichés s’entendent toutes taxes comprises.'}
						</p>

						<h3>Article 3 — Commande et paiement</h3>
						<p>
							Le paiement s&apos;effectue par carte bancaire ou via PayPal. Les coordonnées bancaires sont
							saisies chez le prestataire de paiement et ne transitent jamais par nos serveurs. La commande
							n&apos;est ferme qu&apos;après confirmation du paiement ; un récapitulatif est alors envoyé
							par e-mail.
						</p>

						<h3>Article 4 — Livraison</h3>
						<p>
							Les commandes sont préparées et expédiées depuis la France. Les délais dépendent du mode de
							livraison choisi et sont indiqués au moment de la commande. La livraison est offerte à partir
							de {francoPort} d&apos;achat, ce montant s&apos;appréciant après déduction d&apos;un
							éventuel code de réduction.
						</p>

						<h3>Article 5 — Droit de rétractation</h3>
						<p>
							Vous disposez de quatorze jours à compter de la réception pour changer d&apos;avis, sans
							avoir à vous justifier. L&apos;article doit revenir complet et dans un état permettant sa
							revente ; les frais de retour restent à votre charge.
						</p>
						<p>
							La loi prévoit des exceptions, qui s&apos;appliquent ici (article L221-28 du code de la
							consommation) :
						</p>
						<ul>
							<li>
								les ouvrages numériques téléchargés, dès lors que vous avez demandé le téléchargement
								immédiat et renoncé expressément à votre rétractation ;
							</li>
							<li>
								les jeux, disques et logiciels sous cellophane que vous avez descellés, pour des raisons
								évidentes de revente.
							</li>
						</ul>

						<h3>Article 6 — Garanties</h3>
						<p>
							Tous les articles bénéficient de la garantie légale de conformité et de la garantie contre
							les vices cachés, y compris les articles d&apos;occasion. Un article livré cassé ou non
							conforme à sa description est repris ou remboursé, frais de retour compris.
						</p>

						<h3>Article 7 — Réclamations et médiation</h3>
						<p>
							En cas de désaccord, écrivez-nous d&apos;abord :{' '}
							<Coordonnee valeur={reglages['legal.email']} quoi='Adresse e-mail' />. Si la réponse ne vous
							satisfait pas, vous pouvez saisir gratuitement le médiateur de la consommation dont nous
							relevons : <Coordonnee valeur={reglages['legal.mediator']} quoi='Médiateur' />.
						</p>
					</section>

					<section id='confidentialite' className={styles.section}>
						<h2 className={styles.sectionTitre}>Politique de confidentialité</h2>

						<h3>Ce que nous collectons</h3>
						<p>
							Uniquement ce qui sert à vous livrer et à vous répondre : nom, adresse e-mail, adresse de
							livraison et de facturation, téléphone si vous le donnez, et l&apos;historique de vos
							commandes. Aucune coordonnée bancaire n&apos;est enregistrée sur nos serveurs — elles restent
							chez le prestataire de paiement.
						</p>

						<h3>À quoi elles servent</h3>
						<ul>
							<li>préparer, expédier et facturer vos commandes ;</li>
							<li>répondre à vos questions et gérer les retours ;</li>
							<li>vous envoyer la lettre d&apos;information, uniquement si vous l&apos;avez demandée.</li>
						</ul>

						<h3>Combien de temps</h3>
						<p>
							Votre compte est conservé tant que vous le gardez ouvert. Les factures sont conservées dix
							ans, comme la loi comptable l&apos;impose : c&apos;est la seule chose qui survit à la
							fermeture d&apos;un compte, et elle est alors détachée de votre identité. Votre inscription à
							la lettre d&apos;information dure jusqu&apos;à ce que vous vous désinscriviez.
						</p>

						<h3>Avec qui elles sont partagées</h3>
						<p>
							Avec le transporteur qui vous livre, le prestataire qui encaisse le paiement et
							l&apos;hébergeur du site — chacun pour la seule part qui le concerne. Vos données ne sont ni
							vendues, ni louées, ni transmises à des annonceurs.
						</p>

						<h3>Vos droits</h3>
						<p>
							Vous pouvez consulter, corriger ou faire supprimer vos données à tout moment. La suppression
							se demande directement depuis{' '}
							<Link href='/compte'>votre espace client</Link>, sans avoir à écrire à qui que ce soit. Pour
							le reste, écrivez à <Coordonnee valeur={reglages['legal.email']} quoi='Adresse e-mail' />. Si
							notre réponse ne vous convient pas, vous pouvez saisir la CNIL (
							<a href='https://www.cnil.fr' rel='noopener noreferrer' target='_blank'>
								cnil.fr
							</a>
							).
						</p>
					</section>

					<section id='cookies' className={styles.section}>
						<h2 className={styles.sectionTitre}>Gestion des cookies</h2>

						<h3>Il n&apos;y a rien à accepter ni à refuser</h3>
						<p>
							Ce site ne dépose aucun cookie de mesure d&apos;audience, aucun cookie publicitaire et aucun
							cookie de réseau social. Les quatre cookies posés sont strictement nécessaires au
							fonctionnement du site — sans eux, votre panier se viderait à chaque page. La loi ne demande
							pas votre consentement pour ceux-là.
						</p>
						<p>
							Le bandeau affiché lors de votre première visite est donc une information, pas une
							demande d&apos;autorisation : il n&apos;y a rien à cocher, et le bouton ne fait que le
							refermer. Nous préférons vous le dire plutôt que de vous faire arbitrer un choix qui
							n&apos;existe pas.
						</p>

						<h3>La liste complète</h3>
						<div className={styles.enveloppeTableau}>
							<table className={styles.tableau}>
								<thead>
									<tr>
										<th scope='col'>Cookie</th>
										<th scope='col'>À quoi il sert</th>
										<th scope='col'>Durée</th>
									</tr>
								</thead>
								<tbody>
									{COOKIES.map((cookie) => (
										<tr key={cookie.nom}>
											<td>
												<strong>{cookie.nom}</strong>
											</td>
											<td>{cookie.role}</td>
											<td>{cookie.duree}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<p>
							Vous pouvez les refuser depuis les réglages de votre navigateur. Sachez seulement que le
							panier et la connexion cesseront alors de fonctionner.
						</p>
					</section>
				</div>
			</div>
		</>
	);
}
