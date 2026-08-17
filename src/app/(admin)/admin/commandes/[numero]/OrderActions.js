'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {avancerCommande, expedierUnColis, noterCommande} from '../actions';
import styles from '../../../admin.module.css';

/* Les gestes possibles sur une commande.

   Les boutons proposés viennent du serveur (`suivants`), calculés à partir du
   statut réel : l'écran ne montre jamais « marquer livrée » sur un colis qui
   n'est pas parti. Le service revérifie la transition de son côté — la page a
   pu rester ouverte pendant que la commande avançait ailleurs.

   Les colis ont leur propre bloc, au-dessus de l'avancement. Une commande qui
   mêle du stock et une précommande peut en avoir deux : le premier part tout de
   suite, le second à la réception. Chacun porte son transporteur et son numéro
   de suivi — demandés au moment d'expédier, parce que c'est le seul moment où on
   les a sous les yeux — et chacun envoie son propre avis au client.

   « Marquer expédiée » ne figure plus parmi les boutons d'avancement quand il
   reste un colis à envoyer : le service le refuserait, et proposer un bouton qui
   échoue est la pire des interfaces. */

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

export default function OrderActions({
	numero,
	suivants,
	transporteur,
	note,
	colis = [],
	expediable = false,
}) {
	const [etatStatut, actionStatut] = useActionState(avancerCommande, ETAT_INITIAL);
	const [etatColis, actionColis] = useActionState(expedierUnColis, ETAT_INITIAL);
	const [etatNote, actionNote] = useActionState(noterCommande, ETAT_INITIAL);

	const aExpedier = colis.filter((envoi) => !envoi.shippedAt);

	return (
		<>
			{colis.length > 0 && (
				<div className={styles.carte}>
					<h2 className={styles.carteTitre}>
						{colis.length > 1 ? `Colis (${colis.length})` : 'Colis'}
					</h2>

					{etatColis.statut === 'erreur' && (
						<p className={styles.erreur} role='alert'>
							{etatColis.message}
						</p>
					)}
					{etatColis.statut === 'ok' && <p className={styles.succes}>{etatColis.message}</p>}

					<div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
						{colis.map((envoi) => (
							<div key={envoi.id}>
								<p className={styles.kpiDetail} style={{marginBottom: 6}}>
									<strong>
										{colis.length > 1 ? `Colis ${envoi.position} · ` : ''}
										{envoi.label}
									</strong>
								</p>

								<ul
									className={styles.kpiDetail}
									style={{margin: '0 0 10px', paddingLeft: 18}}>
									{envoi.articles.map((article) => (
										<li key={article.id}>
											{article.nom}
											{article.variante && article.variante !== 'Standard'
												? ` — ${article.variante}`
												: ''}{' '}
											× {article.quantite}
										</li>
									))}
								</ul>

								{envoi.shippedAt ? (
									<p className={styles.kpiDetail}>
										Parti le {envoi.shippedAt}
										{envoi.trackingNumber ? ` · suivi ${envoi.trackingNumber}` : ''}
									</p>
								) : expediable ? (
									<form action={actionColis}>
										<input type='hidden' name='numero' value={numero} />
										<input type='hidden' name='colisId' value={envoi.id} />

										<label className={styles.champ}>
											Transporteur
											<input
												className='input'
												name='transporteur'
												defaultValue={envoi.carrier ?? transporteur ?? ''}
												placeholder='Colissimo, Mondial Relay…'
											/>
										</label>
										<label className={styles.champ}>
											Numéro de suivi
											<input className='input' name='suivi' placeholder='6A12345678901' />
										</label>

										<Bouton>Expédier ce colis</Bouton>
									</form>
								) : (
									<p className={styles.kpiDetail}>Pas encore expédiable.</p>
								)}
							</div>
						))}
					</div>

					{aExpedier.length > 0 && colis.length > 1 && (
						<p className={styles.kpiDetail} style={{marginTop: 14}}>
							Le client reçoit un avis d’expédition à chaque colis parti.
						</p>
					)}
				</div>
			)}

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
