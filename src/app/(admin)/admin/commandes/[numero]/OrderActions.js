'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {avancerCommande, noterCommande} from '../actions';
import styles from '../../../admin.module.css';

/* Les gestes possibles sur une commande.

   Les boutons proposés viennent du serveur (`suivants`), calculés à partir du
   statut réel : l'écran ne montre jamais « marquer livrée » sur un colis qui
   n'est pas parti. Le service revérifie la transition de son côté — la page a
   pu rester ouverte pendant que la commande avançait ailleurs.

   Le numéro de suivi n'est demandé qu'au moment d'expédier, parce que c'est le
   seul moment où on l'a sous les yeux. */

const ETAT_INITIAL = {statut: 'vierge'};

const LIBELLES_ACTION = {
	PREPARING: 'Commencer la préparation',
	SHIPPED: 'Marquer expédiée',
	DELIVERED: 'Marquer livrée',
	CANCELLED: 'Annuler la commande',
};

function Bouton({children, secondaire}) {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className={`btn ${secondaire ? 'btn-secondary' : 'btn-primary'}`}
			style={{padding: '10px 18px', fontSize: 14}}>
			{pending ? 'Un instant…' : children}
		</button>
	);
}

export default function OrderActions({numero, suivants, transporteur, suivi, note}) {
	const [etatStatut, actionStatut] = useActionState(avancerCommande, ETAT_INITIAL);
	const [etatNote, actionNote] = useActionState(noterCommande, ETAT_INITIAL);

	return (
		<>
			<div className={styles.carte}>
				<h2 className={styles.carteTitre}>Avancement</h2>

				{etatStatut.statut === 'erreur' && (
					<p className={styles.erreur} role='alert'>
						{etatStatut.message}
					</p>
				)}
				{etatStatut.statut === 'ok' && <p className={styles.succes}>{etatStatut.message}</p>}

				{suivants.length === 0 ? (
					<p className={styles.kpiDetail}>
						Cette commande est arrivée au bout de son parcours.
					</p>
				) : (
					<div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
						{suivants.map((statut) => (
							<form key={statut} action={actionStatut}>
								<input type='hidden' name='numero' value={numero} />
								<input type='hidden' name='statut' value={statut} />

								{statut === 'SHIPPED' && (
									<>
										<label className={styles.champ}>
											Transporteur
											<input
												className='input'
												name='transporteur'
												defaultValue={transporteur ?? ''}
												placeholder='Colissimo, Mondial Relay…'
											/>
										</label>
										<label className={styles.champ}>
											Numéro de suivi
											<input
												className='input'
												name='suivi'
												defaultValue={suivi ?? ''}
												placeholder='6A12345678901'
											/>
										</label>
									</>
								)}

								<Bouton secondaire={statut === 'CANCELLED'}>
									{LIBELLES_ACTION[statut] ?? statut}
								</Bouton>
							</form>
						))}
					</div>
				)}
			</div>

			<div className={styles.carte}>
				<h2 className={styles.carteTitre}>Note interne</h2>

				{etatNote.statut === 'ok' && <p className={styles.succes}>{etatNote.message}</p>}

				<form action={actionNote}>
					<input type='hidden' name='numero' value={numero} />
					<label className={styles.champ}>
						<span className='sr-only'>Note interne</span>
						<textarea
							className='input'
							name='note'
							rows={4}
							defaultValue={note ?? ''}
							placeholder='Client prévenu du retard, colis refusé, geste commercial…'
							style={{resize: 'vertical', fontFamily: 'inherit'}}
						/>
					</label>
					<Bouton secondaire>Enregistrer la note</Bouton>
				</form>
			</div>
		</>
	);
}
