'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {Check, Star, X} from 'lucide-react';
import {decider, repondre} from './actions';
import {formatDate} from '@/lib/format';
import styles from '../../admin.module.css';

/* Un avis à modérer.

   Tout est sur la carte : la note, le texte entier, la pièce concernée, si
   l'achat est vérifié. Modérer suppose de lire — un tableau qui tronque le
   texte à deux lignes obligerait à ouvrir chaque avis pour décider, et
   transformerait dix minutes de travail en une demi-heure. */

const ETAT_INITIAL = {statut: 'vierge'};

function BoutonDecision({statut, children, principal}) {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			name='statut'
			value={statut}
			disabled={pending}
			className={`btn ${principal ? 'btn-primary' : 'btn-secondary'}`}
			style={{padding: '8px 16px', fontSize: 13.5, gap: 6}}>
			{children}
		</button>
	);
}

function Etoiles({note}) {
	return (
		<span style={{display: 'inline-flex', gap: 2}} aria-label={`${note} sur 5`}>
			{[1, 2, 3, 4, 5].map((rang) => (
				<Star
					key={rang}
					size={15}
					strokeWidth={2.75}
					// L'étoile pleine se lit d'un coup d'œil, l'étoile vide reste
					// visible : on compte sur cinq, pas sur un nombre variable.
					fill={rang <= note ? 'var(--color-accent)' : 'none'}
					color='var(--color-accent)'
				/>
			))}
		</span>
	);
}

export default function ReviewCard({avis}) {
	const [etatDecision, actionDecision] = useActionState(decider, ETAT_INITIAL);
	const [etatReponse, actionReponse] = useActionState(repondre, ETAT_INITIAL);

	return (
		<div className={styles.carte} style={{marginBottom: 16}}>
			<div className={styles.kpiEntete}>
				<div>
					<Etoiles note={avis.rating} />
					<div className={styles.kpiDetail} style={{marginTop: 4}}>
						{avis.product.name} · {avis.authorName}
						{avis.verifiedPurchase && ' · achat vérifié'} ·{' '}
						{formatDate(avis.createdAt)}
					</div>
				</div>
			</div>

			{avis.title && <p style={{fontWeight: 600, margin: '10px 0 6px'}}>{avis.title}</p>}

			<p style={{fontSize: 14.5, lineHeight: 1.6, margin: '0 0 16px', whiteSpace: 'pre-wrap'}}>
				{avis.content}
			</p>

			{etatDecision.statut === 'erreur' && (
				<p className={styles.erreur} role='alert'>
					{etatDecision.message}
				</p>
			)}

			<form action={actionDecision} style={{display: 'flex', gap: 10, marginBottom: 16}}>
				<input type='hidden' name='id' value={avis.id} />

				{avis.status !== 'APPROVED' && (
					<BoutonDecision statut='APPROVED' principal>
						<Check size={15} strokeWidth={2.75} />
						Publier
					</BoutonDecision>
				)}

				{avis.status !== 'REJECTED' && (
					<BoutonDecision statut='REJECTED'>
						<X size={15} strokeWidth={2.75} />
						Refuser
					</BoutonDecision>
				)}

				{/* Remettre en attente : le seul moyen de revenir sur une décision
				    prise trop vite sans avoir à retrouver l'avis dans la liste. */}
				{avis.status !== 'PENDING' && <BoutonDecision statut='PENDING'>Remettre en attente</BoutonDecision>}
			</form>

			<form action={actionReponse}>
				<input type='hidden' name='id' value={avis.id} />

				<label className={styles.champ}>
					Votre réponse publique
					<textarea
						className='input'
						name='reponse'
						rows={2}
						defaultValue={avis.adminReply ?? ''}
						placeholder='Elle s’affichera sous l’avis, signée de la boutique.'
						style={{resize: 'vertical', fontFamily: 'inherit'}}
					/>
				</label>

				{etatReponse.statut === 'ok' && <p className={styles.succes}>{etatReponse.message}</p>}

				<button type='submit' className='btn btn-ghost' style={{padding: '8px 16px', fontSize: 13.5}}>
					Enregistrer la réponse
				</button>
			</form>
		</div>
	);
}
