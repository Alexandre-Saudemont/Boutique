'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {Check} from 'lucide-react';
import {envoyerContact} from './actions';
import styles from './contact.module.css';

/* Le formulaire de contact.

   Client parce qu'il a trois états à montrer — vierge, en cours d'envoi,
   envoyé — et que `useActionState` les tient sans qu'on recharge la page. La
   liste des sujets lui est passée par la page serveur, qui la tient du service :
   les deux extrémités valident donc contre la même liste. */

const ETAT_INITIAL = {statut: 'vierge'};

function Envoyer() {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-primary btn-block'
			style={{padding: 13, fontSize: 15}}>
			{pending ? 'Envoi…' : 'Envoyer le message'}
		</button>
	);
}

export default function ContactForm({sujets}) {
	const [etat, action] = useActionState(envoyerContact, ETAT_INITIAL);

	if (etat.statut === 'envoye') {
		return (
			<div className={styles.confirmation}>
				<span className={styles.pastilleConfirmation} aria-hidden='true'>
					<Check size={30} strokeWidth={2.75} />
				</span>

				<h2 className={styles.titreConfirmation}>Message envoyé, merci !</h2>

				<p className={styles.texteConfirmation}>
					Je vous réponds au plus vite, en général sous 24 h. Le temps d&apos;un café et d&apos;un dé
					lancé.
				</p>
			</div>
		);
	}

	const saisie = etat.saisie ?? {};

	return (
		<form action={action}>
			<h2 className={styles.titreFormulaire}>Envoyer un message</h2>

			{etat.statut === 'erreur' && (
				/* `role="alert"` fait annoncer le message dès son apparition : sans
				   lui, une personne au lecteur d'écran resoumet sans savoir pourquoi
				   rien ne se passe. */
				<p className={styles.erreur} role='alert'>
					{etat.message}
				</p>
			)}

			<div className={styles.duo}>
				<label className={styles.champ}>
					<span>Prénom</span>
					<input
						className='input'
						name='nom'
						required
						maxLength={80}
						autoComplete='given-name'
						placeholder='Votre prénom'
						defaultValue={saisie.nom}
					/>
				</label>

				<label className={styles.champ}>
					<span>E-mail</span>
					<input
						className='input'
						type='email'
						name='email'
						required
						autoComplete='email'
						placeholder='vous@exemple.fr'
						defaultValue={saisie.email}
					/>
				</label>
			</div>

			<label className={styles.champLarge}>
				<span>Sujet</span>
				<select className='input' name='sujet' defaultValue={saisie.sujet || sujets[0]}>
					{sujets.map((sujet) => (
						<option key={sujet} value={sujet}>
							{sujet}
						</option>
					))}
				</select>
			</label>

			<label className={styles.champLarge}>
				<span>Message</span>
				<textarea
					className={`input ${styles.zoneTexte}`}
					name='message'
					rows={5}
					required
					maxLength={4000}
					placeholder='Dites-moi tout…'
					defaultValue={saisie.message}
				/>
			</label>

			{/* Champ-piège. Invisible et hors du parcours clavier — voir contact.module.css. */}
			<div className={styles.piege} aria-hidden='true'>
				<label>
					Ne remplissez pas ce champ
					<input type='text' name='site' tabIndex={-1} autoComplete='off' />
				</label>
			</div>

			<Envoyer />

			<p className={styles.mentionDonnees}>
				Vos données servent uniquement à vous répondre. Jamais de revente, promis.
			</p>
		</form>
	);
}
