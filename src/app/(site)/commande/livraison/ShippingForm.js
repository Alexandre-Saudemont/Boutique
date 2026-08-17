'use client';

import {useActionState, useState} from 'react';
import Link from 'next/link';
import {useFormStatus} from 'react-dom';
import {ArrowLeft} from 'lucide-react';
import {enregistrerLivraison} from '@/app/(site)/commande/actions';
import {formatPrix} from '@/lib/format';
import CartSummary from '@/components/CartSummary/CartSummary';
import styles from '../commande.module.css';

/* Le formulaire de livraison.

   Il est client pour une raison précise : le récapitulatif de droite doit
   afficher les frais du mode sélectionné avant l'envoi. Sans état local, il
   faudrait un aller-retour serveur à chaque changement de radio.

   Le montant affiché ici n'engage rien : `creerCommande` recalcule tout à partir
   du tarif relu en base. Ce que le navigateur montre est une prévision, pas un
   prix. */

const ETAT_INITIAL = {statut: 'vierge'};

function BoutonContinuer() {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-primary btn-block'
			style={{padding: 13, fontSize: 15}}>
			{pending ? 'Un instant…' : 'Aller au paiement'}
		</button>
	);
}

export default function ShippingForm({panier, modes, brouillon}) {
	const [etat, action] = useActionState(enregistrerLivraison, ETAT_INITIAL);

	/* Le mode par défaut : celui déjà choisi si le visiteur revient corriger son
	   adresse, le premier de la liste sinon. */
	const [modeChoisi, setModeChoisi] = useState(
		etat.rateId ?? brouillon?.rateId ?? modes[0]?.id ?? null,
	);

	// Les valeurs reviennent du serveur en cas d'erreur, du cookie si le visiteur
	// revient sur ses pas, et sont vides au premier passage.
	const adresse = etat.adresse ?? brouillon?.adresse ?? {};
	const erreurs = etat.erreurs ?? {};

	const mode = modes.find((candidat) => candidat.id === modeChoisi) ?? null;

	const champ = (nom, libelle, options = {}) => (
		<label className={`field ${options.large ? styles.champLarge : ''}`}>
			<span>{libelle}</span>
			<input
				className='input'
				name={nom}
				type={options.type ?? 'text'}
				autoComplete={options.autoComplete}
				defaultValue={adresse[nom] ?? ''}
				placeholder={options.placeholder}
				aria-invalid={erreurs[nom] ? 'true' : undefined}
				aria-describedby={erreurs[nom] ? `erreur-${nom}` : undefined}
			/>
			{erreurs[nom] && (
				<span id={`erreur-${nom}`} className={styles.erreurChamp}>
					{erreurs[nom]}
				</span>
			)}
		</label>
	);

	/* Un panier entièrement dématérialisé n'a ni mode d'expédition ni adresse
	   postale : demander un code postal pour livrer un fichier fait abandonner
	   des clients, et nous ferait garder des données sans usage. Le serveur
	   revérifie cette condition sur le panier en base — ce que le navigateur
	   affiche ne décide de rien. */
	const {dematerialise} = panier;

	return (
		<form action={action} className={styles.colonnes}>
			<div className={styles.contenu}>
				{dematerialise ? (
					<div className={styles.carte}>
						<p className={styles.carteTitre}>Livraison par e-mail</p>
						<p className={styles.mentionDonnees} style={{marginTop: 8}}>
							Votre panier ne contient que des ouvrages numériques : rien ne part
							par la poste. Vos fichiers vous attendent dès le paiement confirmé,
							par e-mail et dans votre compte.
						</p>
					</div>
				) : (
					<fieldset className={styles.carte}>
						<legend className={styles.carteTitre}>Mode de livraison</legend>

					<div className={styles.modes}>
						{modes.map((candidat) => (
							<label
								key={candidat.id}
								className={`${styles.mode} ${
									modeChoisi === candidat.id ? styles.modeChoisi : ''
								}`}>
								<input
									type='radio'
									name='rateId'
									value={candidat.id}
									checked={modeChoisi === candidat.id}
									onChange={() => setModeChoisi(candidat.id)}
									className={styles.radio}
								/>

								<span className={styles.modeInfos}>
									<span className={styles.modeNom}>{candidat.nom}</span>
									{candidat.delai && (
										<span className={styles.modeDelai}>{candidat.delai}</span>
									)}
								</span>

								<span
									className={`${styles.modePrix} ${
										candidat.prixCents === 0 ? styles.modePrixOffert : ''
									}`}>
									{candidat.prixCents === 0 ? 'Offerte' : formatPrix(candidat.prixCents)}
								</span>
							</label>
						))}
					</div>

						{erreurs.rateId && <p className={styles.erreurChamp}>{erreurs.rateId}</p>}

						{mode?.pointRelais && (
							<p className={styles.noteRelais}>
								Le choix du point relais se fera après le paiement, par e-mail — la
								carte Mondial Relay n&apos;est pas encore branchée.
							</p>
						)}
					</fieldset>
				)}

				<fieldset className={styles.carte}>
					<legend className={styles.carteTitre}>
						{dematerialise ? 'Vos coordonnées' : 'Adresse de livraison'}
					</legend>

					<div className={styles.grilleChamps}>
						{champ('firstName', 'Prénom', {
							autoComplete: 'given-name',
							placeholder: 'Camille',
						})}
						{champ('lastName', 'Nom', {autoComplete: 'family-name', placeholder: 'Renaud'})}

						{!dematerialise && (
							<>
								{champ('line1', 'Adresse', {
									large: true,
									autoComplete: 'address-line1',
									placeholder: '12 rue des Trouvailles',
								})}
								{champ('line2', 'Complément (facultatif)', {
									large: true,
									autoComplete: 'address-line2',
									placeholder: 'Bâtiment B, 3e étage',
								})}
								{champ('postalCode', 'Code postal', {
									autoComplete: 'postal-code',
									placeholder: '69001',
								})}
								{champ('city', 'Ville', {
									autoComplete: 'address-level2',
									placeholder: 'Lyon',
								})}
							</>
						)}

						{champ('email', 'E-mail', {
							large: true,
							type: 'email',
							autoComplete: 'email',
							placeholder: 'vous@exemple.fr',
						})}

						{!dematerialise &&
							champ('phone', 'Téléphone (facultatif)', {
								large: true,
								type: 'tel',
								autoComplete: 'tel',
								placeholder: '06 12 34 56 78',
							})}
					</div>

					<p className={styles.mentionDonnees}>
						{dematerialise
							? 'C’est à cette adresse e-mail que partent vos fichiers. Votre nom ne sert qu’à établir la facture.'
							: 'Ces informations ne servent qu’à préparer et suivre votre commande.'}
					</p>
				</fieldset>

				<label className={`field ${styles.carte}`}>
					<span className={styles.carteTitre}>Un mot pour le vieux geek ? (facultatif)</span>
					<textarea
						name='note'
						rows={3}
						className={`input ${styles.zoneTexte}`}
						defaultValue={brouillon?.note ?? ''}
						placeholder='Une précision sur la livraison, un emballage cadeau…'
					/>
				</label>

				<Link href='/panier' className={styles.retour}>
					<ArrowLeft size={16} strokeWidth={2.75} />
					Retour au panier
				</Link>
			</div>

			<CartSummary
				panier={panier}
				livraisonCents={dematerialise ? 0 : (mode?.prixCents ?? null)}
				action={<BoutonContinuer />}
			/>
		</form>
	);
}
