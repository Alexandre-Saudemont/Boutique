'use client';

import {useActionState} from 'react';
import Link from 'next/link';
import {useFormStatus} from 'react-dom';
import {choisirNouveauMotDePasse} from '../actions';
import styles from '../compte.module.css';

/* Saisie du nouveau mot de passe.

   Deux champs identiques à saisir : une faute de frappe sur un mot de passe
   qu'on ne relit pas enferme dehors, et le seul recours serait de recommencer
   toute la procédure. C'est le seul endroit du site où la double saisie se
   justifie — ailleurs, elle agace pour rien.

   `autoComplete="new-password"` dit au gestionnaire de mots de passe qu'il
   s'agit d'un remplacement : il propose d'en générer un et de mettre à jour
   l'entrée existante au lieu d'en créer une seconde. */

const ETAT_INITIAL = {statut: 'vierge'};

function Bouton() {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-primary btn-block'
			style={{padding: 12}}>
			{pending ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
		</button>
	);
}

export default function ResetForm({jeton}) {
	const [etat, action] = useActionState(choisirNouveauMotDePasse, ETAT_INITIAL);

	return (
		<>
			<form action={action} className={styles.formulaire} style={{marginTop: 22}}>
				<input type='hidden' name='jeton' value={jeton} />

				<label className='field'>
					<span>Nouveau mot de passe</span>
					<input
						className={`input ${styles.champ}`}
						type='password'
						name='motDePasse'
						required
						minLength={10}
						autoComplete='new-password'
					/>
				</label>

				<label className='field'>
					<span>Répétez-le</span>
					<input
						className={`input ${styles.champ}`}
						type='password'
						name='confirmation'
						required
						minLength={10}
						autoComplete='new-password'
					/>
				</label>

				<p className={styles.aide}>
					Dix caractères minimum. Toutes vos sessions ouvertes seront fermées.
				</p>

				<Bouton />
			</form>

			{etat.statut === 'erreur' && (
				<>
					<p className={styles.erreur} role='alert'>
						{etat.message}
					</p>

					<p className={styles.oubli}>
						<Link href='/compte/mot-de-passe-oublie'>Recevoir un nouveau lien</Link>
					</p>
				</>
			)}
		</>
	);
}
