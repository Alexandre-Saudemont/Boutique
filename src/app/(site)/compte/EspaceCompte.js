'use client';

import {useActionState, useState} from 'react';
import Link from 'next/link';
import {useFormStatus} from 'react-dom';
import {Heart, LogOut, MapPin, Package, ShieldCheck, User} from 'lucide-react';
import {enregistrerProfil, seDeconnecter, supprimerMonCompte} from './actions';
import {formatDate, formatPrix} from '@/lib/format';
import styles from './compte.module.css';

/* L'espace du client connecté.

   Quatre sections, une navigation latérale, l'état dans le composant : ce sont
   quatre vues d'un même jeu de données déjà chargé, pas quatre pages. Passer de
   « mes commandes » à « mes informations » ne doit rien recharger.

   Adresses et favoris attendent leur service — les tables existent
   (`Address`, `WishlistItem`), rien ne les alimente encore. Elles annoncent ce
   qui manque plutôt que d'être masquées : un menu qui change de longueur d'une
   version à l'autre déroute plus qu'une section honnêtement vide. */

const ETAT_INITIAL = {statut: 'vierge'};

const LIBELLES_STATUT = {
	PENDING_PAYMENT: 'En attente de paiement',
	PAID: 'Payée',
	PREPARING: 'En préparation',
	SHIPPED: 'Expédiée',
	DELIVERED: 'Livrée',
	CANCELLED: 'Annulée',
	REFUNDED: 'Remboursée',
};

const SECTIONS = [
	{cle: 'commandes', nom: 'Mes commandes', Icone: Package},
	{cle: 'infos', nom: 'Mes informations', Icone: User},
	{cle: 'adresses', nom: 'Mes adresses', Icone: MapPin},
	{cle: 'favoris', nom: 'Mes favoris', Icone: Heart},
	{cle: 'confidentialite', nom: 'Mes données', Icone: ShieldCheck},
];

function BoutonEnregistrer() {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-primary'
			style={{padding: '11px 22px', fontSize: 14.5, marginTop: 8}}>
			{pending ? 'Enregistrement…' : 'Enregistrer'}
		</button>
	);
}

/* Suppression du compte (droit à l'effacement).

   Deux choses sont dites avant le bouton, parce qu'elles surprennent si on les
   découvre après : les commandes passées sont conservées — la loi comptable
   l'impose — et l'opération ne se défait pas.

   Le mot de passe est redemandé : c'est irréversible, et une session ouverte
   sur un poste partagé ne doit pas suffire. */
function SuppressionCompte() {
	const [etat, action] = useActionState(supprimerMonCompte, ETAT_INITIAL);

	return (
		<div className={styles.carteSection}>
			<h2 className={styles.titreSection}>Mes données</h2>

			<p className={styles.texteVide} style={{textAlign: 'left', marginBottom: 18}}>
				Vous pouvez faire supprimer votre compte à tout moment. Votre adresse, votre
				nom, vos préférences et vos favoris sont effacés définitivement.
			</p>

			<p className={styles.texteVide} style={{textAlign: 'left', marginBottom: 18}}>
				Vos <strong>commandes passées sont conservées</strong> : ce sont des pièces
				comptables que je suis tenu de garder dix ans. Elles ne seront plus reliées à
				votre compte, qui n’existera plus.
			</p>

			<form action={action} className={styles.formulaire}>
				<label className='field'>
					<span>Votre mot de passe, pour confirmer</span>
					<input
						className={`input ${styles.champ}`}
						type='password'
						name='motDePasse'
						required
						autoComplete='current-password'
					/>
				</label>

				{etat.statut === 'erreur' && (
					<p className={styles.erreur} role='alert'>
						{etat.message}
					</p>
				)}

				<BoutonSupprimer />
			</form>
		</div>
	);
}

function BoutonSupprimer() {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-secondary'
			style={{padding: '11px 22px', fontSize: 14.5, marginTop: 8}}>
			{pending ? 'Suppression…' : 'Supprimer définitivement mon compte'}
		</button>
	);
}

export default function EspaceCompte({utilisateur, commandes}) {
	const [section, setSection] = useState('commandes');
	const [etat, action] = useActionState(enregistrerProfil, ETAT_INITIAL);

	const nom =
		[utilisateur.firstName, utilisateur.lastName].filter(Boolean).join(' ') ||
		utilisateur.email;

	const initiale = (utilisateur.firstName ?? utilisateur.email).charAt(0).toUpperCase();

	return (
		<>
			<header className={styles.enTeteProfil}>
				<span className={styles.avatar} aria-hidden='true'>
					{initiale}
				</span>

				<div>
					<h1 className={styles.nomProfil}>{nom}</h1>
					<p className={styles.metaProfil}>
						{utilisateur.email} · client depuis {formatDate(utilisateur.createdAt)}
					</p>
				</div>
			</header>

			<div className={styles.grilleCompte}>
				<nav className={styles.navCompte} aria-label='Sections du compte'>
					{SECTIONS.map(({cle, nom: libelle, Icone}) => (
						<button
							key={cle}
							type='button'
							onClick={() => setSection(cle)}
							className={`${styles.entreeNav} ${
								section === cle ? styles.entreeNavActive : ''
							}`}
							aria-current={section === cle ? 'true' : undefined}>
							<Icone size={17} strokeWidth={2.75} />
							{libelle}
						</button>
					))}

					{/* La déconnexion écrit (elle supprime la session) : c'est un
					    formulaire, pas un lien. Un lien serait suivi par un préchargeur
					    ou un antivirus, et déconnecterait le visiteur tout seul. */}
					<form action={seDeconnecter}>
						<button type='submit' className={`${styles.entreeNav} ${styles.deconnexion}`}>
							<LogOut size={17} strokeWidth={2.75} />
							Se déconnecter
						</button>
					</form>
				</nav>

				<div className={styles.contenuCompte}>
					{section === 'commandes' &&
						(commandes.length === 0 ? (
							<div className={styles.sectionVide}>
								<h2 className={styles.titreSection}>Aucune commande pour l&apos;instant</h2>
								<p className={styles.texteVide}>
									Vos commandes apparaîtront ici, avec leur suivi.
								</p>
								<Link href='/boutique' className='btn btn-primary' style={{padding: '11px 22px'}}>
									Explorer la boutique
								</Link>
							</div>
						) : (
							<div className={styles.listeCommandes}>
								{commandes.map((commande) => (
									<article key={commande.id} className={styles.commande}>
										<div>
											<span className={styles.numeroCommande}>{commande.orderNumber}</span>
											<p className={styles.metaCommande}>
												{formatDate(commande.createdAt)} ·{' '}
												{commande.items.reduce((somme, item) => somme + item.quantity, 0)}{' '}
												article(s)
											</p>
										</div>

										<div className={styles.coteCommande}>
											<span className='tag tag-neutral'>
												{LIBELLES_STATUT[commande.status] ?? commande.status}
											</span>
											<span className={styles.totalCommande}>
												{formatPrix(commande.totalCents)}
											</span>
										</div>
									</article>
								))}
							</div>
						))}

					{section === 'infos' && (
						<form action={action} className={styles.carteSection}>
							<h2 className={styles.titreSection}>Mes informations</h2>

							<div className={styles.grilleChamps}>
								<label className='field'>
									<span>Prénom</span>
									<input
										className={`input ${styles.champ}`}
										name='prenom'
										autoComplete='given-name'
										defaultValue={utilisateur.firstName ?? ''}
									/>
								</label>

								<label className='field'>
									<span>Nom</span>
									<input
										className={`input ${styles.champ}`}
										name='nom'
										autoComplete='family-name'
										defaultValue={utilisateur.lastName ?? ''}
									/>
								</label>

								<label className='field'>
									<span>Téléphone</span>
									<input
										className={`input ${styles.champ}`}
										name='telephone'
										type='tel'
										autoComplete='tel'
										defaultValue={utilisateur.phone ?? ''}
									/>
								</label>

								<label className='field'>
									<span>E-mail</span>
									<input
										className={`input ${styles.champ}`}
										value={utilisateur.email}
										disabled
									/>
									<span className={styles.aide}>
										Changer d&apos;adresse demande de la revérifier — écrivez-moi.
									</span>
								</label>
							</div>

							<label className={styles.caseACocher}>
								<input
									type='checkbox'
									name='newsletter'
									defaultChecked={Boolean(utilisateur.marketingOptIn)}
								/>
								<span>Je veux recevoir la lettre de l&apos;antre.</span>
							</label>

							{etat.statut === 'enregistre' && (
								<p className={styles.confirmation} role='status'>
									C&apos;est enregistré.
								</p>
							)}

							{etat.statut === 'erreur' && (
								<p className={styles.erreur} role='alert'>
									{etat.message}
								</p>
							)}

							<BoutonEnregistrer />
						</form>
					)}

					{section === 'adresses' && (
						<div className={styles.sectionVide}>
							<h2 className={styles.titreSection}>Mes adresses</h2>
							<p className={styles.texteVide}>
								Le carnet d&apos;adresses arrive. En attendant, l&apos;adresse se saisit
								à la commande.
							</p>
						</div>
					)}

					{section === 'favoris' && (
						<div className={styles.sectionVide}>
							<h2 className={styles.titreSection}>Mes favoris</h2>
							<p className={styles.texteVide}>
								Le cœur des fiches produit n&apos;est pas encore relié à votre compte.
							</p>
						</div>
					)}

					{section === 'confidentialite' && <SuppressionCompte />}
				</div>
			</div>
		</>
	);
}
