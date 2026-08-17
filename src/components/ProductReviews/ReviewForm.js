'use client';

import {useActionState, useState} from 'react';
import {useFormStatus} from 'react-dom';
import {Star} from 'lucide-react';
import {laisserUnAvis} from '@/app/(site)/produit/actions';
import styles from './ProductReviews.module.css';

/* Dépôt d'un avis.

   La note passe par de vrais boutons radio, masqués sous les étoiles : au
   clavier, on les parcourt avec les flèches comme n'importe quel groupe de
   choix, et un lecteur d'écran annonce « 4 étoiles sur 5 ». Cinq images
   cliquables auraient été inutilisables sans souris. */

const ETAT_INITIAL = {statut: 'vierge'};

function Bouton() {
	const {pending} = useFormStatus();

	return (
		<button type='submit' disabled={pending} className='btn btn-primary' style={{padding: '11px 22px'}}>
			{pending ? 'Envoi…' : 'Envoyer mon avis'}
		</button>
	);
}

export default function ReviewForm({produitId}) {
	const [etat, action] = useActionState(laisserUnAvis, ETAT_INITIAL);
	const [note, setNote] = useState(0);

	if (etat.statut === 'depose') {
		return (
			<div className={styles.formulaire}>
				<p className={styles.confirmation}>
					{etat.enAttente
						? 'Merci ! Votre avis part à la relecture — je le publie dès que je l’ai lu.'
						: 'Merci ! Votre avis est en ligne.'}
				</p>
			</div>
		);
	}

	const erreurs = etat.erreurs ?? {};

	return (
		<form action={action} className={styles.formulaire}>
			<input type='hidden' name='produitId' value={produitId} />

			<h3 className={styles.formulaireTitre}>Votre avis sur cette pièce</h3>

			{etat.statut === 'erreur' && etat.message && (
				<p className={styles.erreur} role='alert'>
					{etat.message}
				</p>
			)}

			<fieldset style={{border: 'none', padding: 0, margin: '0 0 4px'}}>
				<legend className={styles.champ} style={{marginBottom: 8}}>
					Votre note
				</legend>

				<div className={styles.notes}>
					{[1, 2, 3, 4, 5].map((valeur) => (
						<label
							key={valeur}
							className={`${styles.noteChoix} ${valeur <= note ? styles.noteActive : ''}`}>
							<input
								type='radio'
								name='note'
								value={valeur}
								checked={note === valeur}
								onChange={() => setNote(valeur)}
								required
							/>
							<Star
								size={28}
								strokeWidth={2.75}
								fill={valeur <= note ? 'currentColor' : 'none'}
								aria-label={`${valeur} étoile${valeur > 1 ? 's' : ''} sur 5`}
							/>
						</label>
					))}
				</div>

				{erreurs.note && <p className={styles.erreur}>{erreurs.note}</p>}
			</fieldset>

			<label className={styles.champ}>
				Un titre (facultatif)
				<input className='input' name='titre' placeholder='Une pièce à la hauteur' />
			</label>

			<label className={styles.champ}>
				Votre avis
				<textarea
					className='input'
					name='contenu'
					rows={5}
					required
					minLength={10}
					maxLength={4000}
					placeholder='Ce qui vous a plu, ce qui vous a surpris, l’état à la réception…'
					style={{resize: 'vertical', fontFamily: 'inherit'}}
				/>
				{erreurs.contenu && <span className={styles.erreur}>{erreurs.contenu}</span>}
			</label>

			<Bouton />
		</form>
	);
}
