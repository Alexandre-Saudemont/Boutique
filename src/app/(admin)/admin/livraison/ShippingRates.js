'use client';

import {useActionState, useState} from 'react';
import {useFormStatus} from 'react-dom';
import {Pencil, Plus, X} from 'lucide-react';
import {basculer, sauvegarderTarif, sauvegarderZone} from './actions';
import {formatPrix} from '@/lib/format';
import styles from '../../admin.module.css';

/* Modes de livraison et zones.

   Un seul écran, deux niveaux : les zones (France, Union européenne…) et, à
   l'intérieur, les modes proposés. Les séparer en deux pages obligerait à
   naviguer pour comprendre ce qui est proposé où — alors que c'est justement le
   rapport entre les deux qui intéresse.

   Le formulaire s'ouvre au-dessus de la liste plutôt que dans un panneau
   latéral : il y a six champs, et voir la liste pendant qu'on saisit aide à ne
   pas créer deux fois « Colissimo ». */

const ETAT_INITIAL = {statut: 'vierge'};

const TARIF_VIERGE = {
	id: '',
	nom: '',
	transporteur: '',
	prix: '',
	franco: '',
	delai: '',
	pointRelais: false,
	actif: true,
	position: 0,
};

function Bouton({children}) {
	const {pending} = useFormStatus();

	return (
		<button type='submit' disabled={pending} className='btn btn-primary' style={{padding: '10px 20px'}}>
			{pending ? 'Enregistrement…' : children}
		</button>
	);
}

function BasculeTarif({tarif}) {
	const [, action] = useActionState(basculer, ETAT_INITIAL);

	return (
		<form action={action} style={{display: 'inline'}}>
			<input type='hidden' name='id' value={tarif.id} />
			<input type='hidden' name='actif' value={tarif.isActive ? '0' : '1'} />
			<button type='submit' className='btn btn-ghost' style={{padding: '6px 12px', fontSize: 13}}>
				{tarif.isActive ? 'Désactiver' : 'Réactiver'}
			</button>
		</form>
	);
}

export default function ShippingRates({zones}) {
	const [etatTarif, actionTarif] = useActionState(sauvegarderTarif, ETAT_INITIAL);
	const [etatZone, actionZone] = useActionState(sauvegarderZone, ETAT_INITIAL);

	// `null` = aucun formulaire ouvert ; un objet = tarif en cours d'édition.
	const [enEdition, setEnEdition] = useState(null);
	const [zoneOuverte, setZoneOuverte] = useState(false);

	const erreurs = etatTarif.erreurs ?? {};

	function editer(tarif, zoneId) {
		setEnEdition({
			id: tarif.id,
			nom: tarif.name,
			transporteur: tarif.carrier,
			prix: (tarif.priceCents / 100).toFixed(2).replace('.', ','),
			franco:
				tarif.freeAboveCents === null
					? ''
					: (tarif.freeAboveCents / 100).toFixed(2).replace('.', ','),
			delai: tarif.estimatedDays ?? '',
			pointRelais: tarif.isRelayPoint,
			actif: tarif.isActive,
			position: tarif.position,
			zoneId,
		});
	}

	return (
		<div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
			{enEdition && (
				<div className={styles.carte}>
					<div className={styles.kpiEntete}>
						<h2 className={styles.carteTitre} style={{margin: 0}}>
							{enEdition.id ? 'Modifier le mode' : 'Nouveau mode de livraison'}
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

					{etatTarif.statut === 'erreur' && (
						<p className={styles.erreur} role='alert'>
							{etatTarif.message}
						</p>
					)}

					<form action={actionTarif}>
						<input type='hidden' name='id' value={enEdition.id} />
						<input type='hidden' name='zoneId' value={enEdition.zoneId} />

						<div style={{display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14}}>
							<label className={styles.champ}>
								Nom affiché au client
								<input
									className='input'
									name='nom'
									defaultValue={enEdition.nom}
									placeholder='Colissimo à domicile'
									required
								/>
								{erreurs.nom && <span className={styles.erreur}>{erreurs.nom}</span>}
							</label>

							<label className={styles.champ}>
								Transporteur
								<input
									className='input'
									name='transporteur'
									defaultValue={enEdition.transporteur}
									placeholder='La Poste, Mondial Relay…'
									required
								/>
							</label>
						</div>

						<div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14}}>
							<label className={styles.champ}>
								Prix (€)
								<input
									className='input'
									name='prix'
									defaultValue={enEdition.prix}
									placeholder='5,90'
									inputMode='decimal'
								/>
								{erreurs.prix && <span className={styles.erreur}>{erreurs.prix}</span>}
							</label>

							<label className={styles.champ}>
								Offerte à partir de (€)
								<input
									className='input'
									name='franco'
									defaultValue={enEdition.franco}
									placeholder='Laisser vide'
									inputMode='decimal'
								/>
								{erreurs.franco && <span className={styles.erreur}>{erreurs.franco}</span>}
							</label>

							<label className={styles.champ}>
								Délai annoncé
								<input
									className='input'
									name='delai'
									defaultValue={enEdition.delai}
									placeholder='2 à 3 jours'
								/>
							</label>
						</div>

						<div style={{display: 'flex', gap: 24, alignItems: 'center', marginBottom: 18}}>
							<label style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 14}}>
								<input
									type='checkbox'
									name='pointRelais'
									defaultChecked={enEdition.pointRelais}
									style={{width: 18, height: 18, accentColor: 'var(--color-accent)'}}
								/>
								Point relais
							</label>

							<label style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 14}}>
								<input
									type='checkbox'
									name='actif'
									defaultChecked={enEdition.actif}
									style={{width: 18, height: 18, accentColor: 'var(--color-accent)'}}
								/>
								Proposé aux clients
							</label>
						</div>

						{/* Le point relais demande au client de choisir son point sur une
						    carte — ce branchement n'existe pas encore. La case sert à
						    marquer le mode dès maintenant ; la carte viendra après. */}
						<p className={styles.kpiDetail} style={{marginTop: -8, marginBottom: 16}}>
							Un mode « point relais » ne propose pas encore de carte au client :
							il commandera comme pour une livraison à domicile.
						</p>

						<Bouton>Enregistrer</Bouton>
					</form>
				</div>
			)}

			{zones.map((zone) => (
				<div key={zone.id} className={styles.tableauCadre}>
					<div className={styles.filtres}>
						<h2 className={styles.carteTitre} style={{margin: 0}}>
							{zone.name}
						</h2>
						<span className={styles.celluleDiscrete} style={{fontSize: 13}}>
							{zone.countries.join(', ')}
						</span>

						<button
							type='button'
							className='btn btn-secondary'
							onClick={() => setEnEdition({...TARIF_VIERGE, zoneId: zone.id})}
							style={{marginLeft: 'auto', gap: 8, fontSize: 13.5, padding: '8px 14px'}}>
							<Plus size={15} strokeWidth={2.75} />
							Ajouter un mode
						</button>
					</div>

					{zone.rates.length === 0 ? (
						<p className={styles.vide}>Aucun mode de livraison dans cette zone.</p>
					) : (
						<div className={styles.tableauDefile}>
							<table className={styles.tableau}>
								<thead>
									<tr>
										<th>Mode</th>
										<th>Transporteur</th>
										<th>Prix</th>
										<th>Offerte dès</th>
										<th>Délai</th>
										<th>État</th>
										<th className={styles.celluleActions}>Actions</th>
									</tr>
								</thead>
								<tbody>
									{zone.rates.map((tarif) => (
										<tr key={tarif.id}>
											<td className={styles.cellulePrincipale}>
												{tarif.name}
												{tarif.isRelayPoint && (
													<span className={styles.celluleDiscrete}>
														{' '}
														· point relais
													</span>
												)}
											</td>
											<td className={styles.celluleDiscrete}>{tarif.carrier}</td>
											<td className={styles.celluleMontant}>
												{formatPrix(tarif.priceCents)}
											</td>
											<td className={styles.celluleDiscrete}>
												{tarif.freeAboveCents === null
													? '—'
													: formatPrix(tarif.freeAboveCents)}
											</td>
											<td className={styles.celluleDiscrete}>
												{tarif.estimatedDays ?? '—'}
											</td>
											<td className={styles.celluleDiscrete}>
												{tarif.isActive ? 'Proposé' : 'Désactivé'}
											</td>
											<td className={styles.celluleActions}>
												<button
													type='button'
													className='btn btn-ghost'
													onClick={() => editer(tarif, zone.id)}
													aria-label={`Modifier ${tarif.name}`}
													style={{padding: 8}}>
													<Pencil size={15} strokeWidth={2.75} />
												</button>
												<BasculeTarif tarif={tarif} />
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			))}

			<div className={styles.carte}>
				{zoneOuverte ? (
					<>
						<h2 className={styles.carteTitre}>Nouvelle zone</h2>

						{etatZone.statut === 'erreur' && (
							<p className={styles.erreur} role='alert'>
								{etatZone.message}
							</p>
						)}

						<form action={actionZone}>
							<div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14}}>
								<label className={styles.champ}>
									Nom de la zone
									<input
										className='input'
										name='nom'
										placeholder='Union européenne'
										required
									/>
								</label>

								<label className={styles.champ}>
									Pays (codes séparés par des virgules)
									<input className='input' name='pays' placeholder='BE, LU, DE' required />
									{etatZone.erreurs?.pays && (
										<span className={styles.erreur}>{etatZone.erreurs.pays}</span>
									)}
								</label>
							</div>

							<div style={{display: 'flex', gap: 10}}>
								<Bouton>Créer la zone</Bouton>
								<button
									type='button'
									className='btn btn-ghost'
									onClick={() => setZoneOuverte(false)}
									style={{padding: '10px 18px'}}>
									Annuler
								</button>
							</div>
						</form>
					</>
				) : (
					<button
						type='button'
						className='btn btn-secondary'
						onClick={() => setZoneOuverte(true)}
						style={{gap: 8, fontSize: 13.5, padding: '9px 16px'}}>
						<Plus size={16} strokeWidth={2.75} />
						Ajouter une zone
					</button>
				)}
			</div>
		</div>
	);
}
