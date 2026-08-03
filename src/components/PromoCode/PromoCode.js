'use client';

import {useActionState, useState} from 'react';
import {useFormStatus} from 'react-dom';
import {Tag} from 'lucide-react';
import {appliquerCode, retirerCode} from '@/app/(site)/panier/actions';
import styles from './PromoCode.module.css';

/* Le champ « code promo ».

   Replié par défaut, derrière un lien discret. Un champ bien visible rappelle à
   ceux qui n'ont pas de code qu'ils paient plein tarif, et les envoie en
   chercher un ailleurs — parfois jusqu'à quitter la commande pour n'y jamais
   revenir. Ceux qui en ont un le cherchent, et le trouvent.

   Le code appliqué est affiché en clair avec un moyen de le retirer : rien de
   pire qu'une réduction qu'on ne comprend pas et qu'on ne peut pas annuler. */

const ETAT_INITIAL = {statut: 'vierge'};

function BoutonAppliquer() {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-secondary'
			style={{padding: '10px 16px', fontSize: 13.5}}>
			{pending ? '…' : 'Appliquer'}
		</button>
	);
}

export default function PromoCode({promo}) {
	const [etat, action] = useActionState(appliquerCode, ETAT_INITIAL);
	const [, actionRetrait] = useActionState(retirerCode, ETAT_INITIAL);
	const [ouvert, setOuvert] = useState(false);

	if (promo) {
		return (
			<div className={styles.bloc}>
				<div className={styles.applique}>
					<Tag size={15} strokeWidth={2.75} />
					<span className={styles.codeApplique}>{promo.code}</span>

					<form action={actionRetrait}>
						<button type='submit' className={styles.retirer}>
							Retirer
						</button>
					</form>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.bloc}>
			{ouvert ? (
				<>
					<form action={action} className={styles.formulaire}>
						<input
							className={`input ${styles.champ}`}
							name='code'
							placeholder='VOTRECODE'
							aria-label='Code de réduction'
							autoComplete='off'
							required
						/>
						<BoutonAppliquer />
					</form>

					{etat.statut === 'erreur' && (
						<p className={styles.erreur} role='alert'>
							{etat.message}
						</p>
					)}
				</>
			) : (
				<button type='button' className={styles.declencheur} onClick={() => setOuvert(true)}>
					J’ai un code de réduction
				</button>
			)}
		</div>
	);
}
