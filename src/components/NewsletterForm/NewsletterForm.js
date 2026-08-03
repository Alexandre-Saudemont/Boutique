'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {inscrireNewsletter} from '@/app/(site)/actions';
import styles from './NewsletterForm.module.css';

/* Inscription à la liste d'attente.

   Le même formulaire sert à deux endroits de l'accueil, sur deux fonds
   différents — d'où la prop `variante` : `claire` sur le fond crème,
   `accent` sur le grand bloc terracotta où le bouton doit passer en sombre.

   `source` est enregistrée avec l'adresse : savoir si les inscriptions viennent
   du bandeau ou du pied de page dit au client quel argument convainc.

   Le formulaire fonctionne sans JavaScript : `action` est une action serveur,
   le navigateur poste et Next rejoue le rendu. `useActionState` n'ajoute que le
   confort — message d'erreur et état d'envoi sans rechargement. */

const ETAT_INITIAL = {statut: 'vierge'};

function Bouton({libelle, variante}) {
	/* `useFormStatus` doit vivre dans un enfant du <form> : appelé dans le même
	   composant, il ne verrait jamais l'envoi passer. */
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className={`btn ${variante === 'accent' ? styles.boutonSombre : 'btn-primary'}`}
			style={{padding: '10px 22px', whiteSpace: 'nowrap'}}>
			{pending ? 'Un instant…' : libelle}
		</button>
	);
}

export default function NewsletterForm({
	source,
	libelle = 'Me prévenir',
	variante = 'claire',
}) {
	const [etat, action] = useActionState(inscrireNewsletter, ETAT_INITIAL);

	if (etat.statut === 'inscrit') {
		return (
			<p
				className={`${styles.confirmation} ${
					variante === 'accent' ? styles.confirmationSombre : ''
				}`}
				role='status'>
				Merci ! Vous êtes sur la liste — on se retrouve à l&apos;ouverture. 🎉
			</p>
		);
	}

	return (
		<div className={styles.bloc}>
			<form action={action} className={styles.formulaire}>
				<input type='hidden' name='source' value={source} />

				<input
					type='email'
					name='email'
					required
					defaultValue={etat.email ?? ''}
					placeholder='vous@exemple.fr'
					aria-label='Votre adresse e-mail'
					aria-invalid={etat.statut === 'erreur' || undefined}
					className={`input ${styles.champ} ${
						variante === 'accent' ? styles.champSombre : ''
					}`}
				/>

				<Bouton libelle={libelle} variante={variante} />
			</form>

			{etat.statut === 'erreur' && (
				<p
					className={`${styles.erreur} ${
						variante === 'accent' ? styles.erreurSombre : ''
					}`}
					role='alert'>
					{etat.message}
				</p>
			)}
		</div>
	);
}
