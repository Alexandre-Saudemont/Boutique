'use client';

import {useActionState, useState} from 'react';
import {useFormStatus} from 'react-dom';
import {Pencil, Plus, Trash2, X} from 'lucide-react';
import {retirerMascotte, sauvegarderMascotte} from './actions';
import {formatDate} from '@/lib/format';
import styles from '../../admin.module.css';

/* Liste des périodes + formulaire d'ajout/édition, sur le modèle de l'écran
   Livraison : le formulaire s'ouvre au-dessus de la liste. Aucune validation
   ici : les messages viennent du serveur. */

const ETAT_INITIAL = {statut: 'vierge'};

const VIERGE = {id: '', nom: '', imageUrl: '', alt: '', debut: '', fin: '', actif: true};

function jour(date) {
	return new Date(date).toISOString().slice(0, 10);
}

function Bouton({children}) {
	const {pending} = useFormStatus();

	return (
		<button type='submit' disabled={pending} className='btn btn-primary' style={{padding: '10px 20px'}}>
			{pending ? 'Enregistrement…' : children}
		</button>
	);
}

function Retirer({id}) {
	const [, action] = useActionState(retirerMascotte, ETAT_INITIAL);

	return (
		<form action={action} style={{display: 'inline'}}>
			<input type='hidden' name='id' value={id} />
			<button
				type='submit'
				className='btn btn-ghost'
				aria-label='Supprimer cette période'
				style={{padding: 8}}>
				<Trash2 size={15} strokeWidth={2.75} />
			</button>
		</form>
	);
}

function statut(mascotte, maintenant) {
	if (!mascotte.isActive) return 'Désactivée';
	if (new Date(mascotte.endsAt) < maintenant) return 'Terminée';
	if (new Date(mascotte.startsAt) > maintenant) return 'À venir';
	return 'En cours';
}

export default function MascotteGestion({mascottes}) {
	const [etat, action] = useActionState(sauvegarderMascotte, ETAT_INITIAL);
	const [enEdition, setEnEdition] = useState(null);
	const erreurs = etat.erreurs ?? {};
	// Après un refus, on repart de ce qui a été tapé (voir l'action) — mais
	// seulement pour la même fiche, jamais pour une autre période.
	const valeurs =
		etat.statut === 'erreur' && enEdition && (etat.valeurs.id ?? '') === enEdition.id
			? etat.valeurs
			: enEdition;
	const maintenant = new Date();

	return (
		<div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
			{enEdition && (
				<div className={styles.carte}>
					<div className={styles.kpiEntete}>
						<h2 className={styles.carteTitre} style={{margin: 0}}>
							{enEdition.id ? 'Modifier la période' : 'Nouvelle période'}
						</h2>
						<button
							type='button'
							className='btn btn-ghost'
							onClick={() => setEnEdition(null)}
							aria-label='Fermer'
							style={{padding: 8}}>
							<X size={16} strokeWidth={2.75} />
						</button>
					</div>

					{etat.statut === 'erreur' && (
						<p className={styles.erreur} role='alert'>
							{etat.message}
						</p>
					)}

					<form action={action}>
						<input type='hidden' name='id' value={enEdition.id} />

						<label className={styles.champ}>
							Nom (pour vous repérer)
							<input
								className='input'
								name='nom'
								defaultValue={valeurs.nom}
								placeholder='Halloween 2026'
								required
							/>
							{erreurs.nom && <span className={styles.erreur}>{erreurs.nom}</span>}
						</label>

						<label className={styles.champ}>
							Adresse de l’image
							<input
								className='input'
								name='imageUrl'
								defaultValue={valeurs.imageUrl}
								placeholder='https://…'
								required
							/>
							{erreurs.imageUrl && <span className={styles.erreur}>{erreurs.imageUrl}</span>}
						</label>

						<label className={styles.champ}>
							Description de l’image (accessibilité)
							<input
								className='input'
								name='alt'
								defaultValue={valeurs.alt}
								placeholder='Le Vieux geek déguisé en citrouille'
							/>
						</label>

						<div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14}}>
							<label className={styles.champ}>
								Du
								<input className='input' type='date' name='debut' defaultValue={valeurs.debut} required />
								{erreurs.debut && <span className={styles.erreur}>{erreurs.debut}</span>}
							</label>

							<label className={styles.champ}>
								Au (jour inclus)
								<input className='input' type='date' name='fin' defaultValue={valeurs.fin} required />
								{erreurs.fin && <span className={styles.erreur}>{erreurs.fin}</span>}
							</label>
						</div>

						<label
							className={styles.champ}
							style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
							<input
								type='checkbox'
								name='actif'
								defaultChecked={valeurs.actif}
								style={{width: 18, height: 18, accentColor: 'var(--color-accent)'}}
							/>
							Active
						</label>

						<Bouton>Enregistrer</Bouton>
					</form>
				</div>
			)}

			{etat.statut === 'ok' && !enEdition && <p className={styles.succes}>{etat.message}</p>}

			<div className={styles.tableauCadre}>
				<div className={styles.filtres}>
					<h2 className={styles.carteTitre} style={{margin: 0}}>
						Périodes
					</h2>
					<button
						type='button'
						className='btn btn-secondary'
						onClick={() => setEnEdition({...VIERGE})}
						style={{marginLeft: 'auto', gap: 8, fontSize: 13.5, padding: '8px 14px'}}>
						<Plus size={15} strokeWidth={2.75} />
						Ajouter une période
					</button>
				</div>

				{mascottes.length === 0 ? (
					<p className={styles.vide}>
						Aucune période. Le header n’affiche pas de mascotte pour l’instant.
					</p>
				) : (
					<div className={styles.tableauDefile}>
						<table className={styles.tableau}>
							<thead>
								<tr>
									<th>Image</th>
									<th>Nom</th>
									<th>Du</th>
									<th>Au</th>
									<th>État</th>
									<th className={styles.celluleActions}>Actions</th>
								</tr>
							</thead>
							<tbody>
								{mascottes.map((mascotte) => (
									<tr key={mascotte.id}>
										<td>
											{/* eslint-disable-next-line @next/next/no-img-element */}
											<img
												src={mascotte.imageUrl}
												alt={mascotte.alt}
												width={40}
												height={40}
												style={{objectFit: 'contain'}}
											/>
										</td>
										<td className={styles.cellulePrincipale}>{mascotte.name}</td>
										<td className={styles.celluleDiscrete}>{formatDate(mascotte.startsAt)}</td>
										<td className={styles.celluleDiscrete}>{formatDate(mascotte.endsAt)}</td>
										<td className={styles.celluleDiscrete}>{statut(mascotte, maintenant)}</td>
										<td className={styles.celluleActions}>
											<button
												type='button'
												className='btn btn-ghost'
												aria-label={`Modifier ${mascotte.name}`}
												onClick={() =>
													setEnEdition({
														id: mascotte.id,
														nom: mascotte.name,
														imageUrl: mascotte.imageUrl,
														alt: mascotte.alt,
														debut: jour(mascotte.startsAt),
														fin: jour(mascotte.endsAt),
														actif: mascotte.isActive,
													})
												}
												style={{padding: 8}}>
												<Pencil size={15} strokeWidth={2.75} />
											</button>
											<Retirer id={mascotte.id} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
