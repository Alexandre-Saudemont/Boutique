'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {MailCheck} from 'lucide-react';
import {demanderNouveauMotDePasse} from '../actions';
import styles from '../compte.module.css';

/* Formulaire de demande de lien.

   Aucun message d'erreur possible : quelle que soit l'adresse saisie, connue ou
   non, l'écran affiche la même confirmation. C'est volontaire et ça se voit
   dans le code — il n'y a tout simplement pas de branche « erreur ». */

const ETAT_INITIAL = {statut: 'vierge'};

function Bouton() {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-primary btn-block'
			style={{padding: 12}}>
			{pending ? 'Envoi…' : 'Envoyer le lien'}
		</button>
	);
}

export default function ForgotForm() {
	const [etat, action] = useActionState(demanderNouveauMotDePasse, ETAT_INITIAL);

	if (etat.statut === 'envoye') {
		return (
			<div style={{marginTop: 22}}>
				<span className={styles.iconeMail}>
					<MailCheck size={28} strokeWidth={2.75} />
				</span>

				<p className={styles.texteAuth}>
					Si un compte existe à cette adresse, le lien vient de partir. Il est valable
					une heure. Pensez à regarder dans les indésirables.
				</p>
			</div>
		);
	}

	return (
		<form action={action} className={styles.formulaire} style={{marginTop: 22}}>
			<label className='field'>
				<span>E-mail</span>
				<input
					className={`input ${styles.champ}`}
					type='email'
					name='email'
					required
					autoComplete='email'
					placeholder='vous@exemple.fr'
				/>
			</label>

			<Bouton />
		</form>
	);
}
