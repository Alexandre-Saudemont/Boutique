'use client';

import {useActionState, useState} from 'react';
import {useFormStatus} from 'react-dom';
import {Pencil, Plus, X} from 'lucide-react';
import {basculer, sauvegarderCode} from './actions';
import {formatPrix} from '@/lib/format';
import styles from '../../admin.module.css';

/* Codes de réduction.

   Le formulaire s'adapte au type choisi : « pourcentage » demande un nombre de
   1 à 100, « montant fixe » des euros, « livraison offerte » ne demande rien du
   tout. Afficher les trois champs en permanence obligerait à deviner lequel
   compte — et à laisser des valeurs mortes en base.

   La colonne « utilisé » est ce qu'on vient regarder après une campagne : elle
   dit si le code a servi, et combien il en reste. */

const ETAT_INITIAL = {statut: 'vierge'};

const CODE_VIERGE = {
	id: '',
	code: '',
	description: '',
	type: 'PERCENT',
	valeur: '',
	minimum: '',
	debut: '',
	fin: '',
	maxUtilisations: '',
	actif: true,
};

function Bouton() {
	const {pending} = useFormStatus();

	return (
		<button type='submit' disabled={pending} className='btn btn-primary' style={{padding: '10px 20px'}}>
			{pending ? 'Enregistrement…' : 'Enregistrer'}
		</button>
	);
}

function Bascule({promo}) {
	const [, action] = useActionState(basculer, ETAT_INITIAL);

	return (
		<form action={action} style={{display: 'inline'}}>
			<input type='hidden' name='id' value={promo.id} />
			<input type='hidden' name='actif' value={promo.isActive ? '0' : '1'} />
			<button type='submit' className='btn btn-ghost' style={{padding: '6px 12px', fontSize: 13}}>
				{promo.isActive ? 'Désactiver' : 'Réactiver'}
			</button>
		</form>
	);
}

/// Une date ISO tronquée au jour, format attendu par `<input type="date">`.
function pourChampDate(valeur) {
	return valeur ? new Date(valeur).toISOString().slice(0, 10) : '';
}

function libelleValeur(promo) {
	if (promo.type === 'FREE_SHIPPING') return 'Livraison offerte';
	if (promo.type === 'PERCENT') return `−${(promo.percentBp / 100).toFixed(0)} %`;

	return `−${formatPrix(promo.amountCents)}`;
}

export default function PromoTable({promos}) {
	const [etat, action] = useActionState(sauvegarderCode, ETAT_INITIAL);
	const [enEdition, setEnEdition] = useState(null);
	const [type, setType] = useState('PERCENT');

	const erreurs = etat.erreurs ?? {};

	function editer(promo) {
		const valeur =
			promo.type === 'PERCENT'
				? String(promo.percentBp / 100)
				: promo.type === 'FIXED'
					? (promo.amountCents / 100).toFixed(2).replace('.', ',')
					: '';

		setType(promo.type);
		setEnEdition({
			id: promo.id,
			code: promo.code,
			description: promo.description ?? '',
			type: promo.type,
			valeur,
			minimum:
				promo.minSubtotalCents === null
					? ''
					: (promo.minSubtotalCents / 100).toFixed(2).replace('.', ','),
			debut: pourChampDate(promo.startsAt),
			fin: pourChampDate(promo.endsAt),
			maxUtilisations: promo.maxUses === null ? '' : String(promo.maxUses),
			actif: promo.isActive,
		});
	}

	return (
		<>
			{enEdition && (
				<div className={styles.carte} style={{marginBottom: 20}}>
					<div className={styles.kpiEntete}>
						<h2 className={styles.carteTitre} style={{margin: 0}}>
							{enEdition.id ? `Modifier ${enEdition.code}` : 'Nouveau code'}
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

						<div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14}}>
							<label className={styles.champ}>
								Code
								<input
									className='input'
									name='code'
									defaultValue={enEdition.code}
									placeholder='BIENVENUE10'
									style={{textTransform: 'uppercase'}}
									required
								/>
								{erreurs.code && <span className={styles.erreur}>{erreurs.code}</span>}
							</label>

							<label className={styles.champ}>
								Description (usage interne)
								<input
									className='input'
									name='description'
									defaultValue={enEdition.description}
									placeholder='Ouverture de la boutique'
								/>
							</label>
						</div>

						<div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14}}>
							<label className={styles.champ}>
								Type
								<select
									className='input'
									name='type'
									value={type}
									onChange={(e) => setType(e.target.value)}>
									<option value='PERCENT'>Pourcentage</option>
									<option value='FIXED'>Montant fixe</option>
									<option value='FREE_SHIPPING'>Livraison offerte</option>
								</select>
							</label>

							{/* Le champ de valeur n'existe que pour les types qui en ont
							    besoin : un code « livraison offerte » n'a pas de montant. */}
							{type !== 'FREE_SHIPPING' && (
								<label className={styles.champ}>
									{type === 'PERCENT' ? 'Pourcentage' : 'Montant (€)'}
									<input
										className='input'
										name='valeur'
										defaultValue={enEdition.valeur}
										placeholder={type === 'PERCENT' ? '10' : '5,00'}
										inputMode='decimal'
									/>
									{erreurs.valeur && (
										<span className={styles.erreur}>{erreurs.valeur}</span>
									)}
								</label>
							)}

							<label className={styles.champ}>
								Panier minimum (€)
								<input
									className='input'
									name='minimum'
									defaultValue={enEdition.minimum}
									placeholder='Aucun'
									inputMode='decimal'
								/>
							</label>
						</div>

						<div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14}}>
							<label className={styles.champ}>
								Valable à partir du
								<input
									className='input'
									type='date'
									name='debut'
									defaultValue={enEdition.debut}
								/>
							</label>

							<label className={styles.champ}>
								Jusqu’au
								<input className='input' type='date' name='fin' defaultValue={enEdition.fin} />
								{erreurs.fin && <span className={styles.erreur}>{erreurs.fin}</span>}
							</label>

							<label className={styles.champ}>
								Utilisations maximum
								<input
									className='input'
									name='maxUtilisations'
									defaultValue={enEdition.maxUtilisations}
									placeholder='Illimité'
									inputMode='numeric'
								/>
							</label>
						</div>

						<label
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 10,
								fontSize: 14,
								marginBottom: 18,
							}}>
							<input
								type='checkbox'
								name='actif'
								defaultChecked={enEdition.actif}
								style={{width: 18, height: 18, accentColor: 'var(--color-accent)'}}
							/>
							Code actif
						</label>

						<p className={styles.kpiDetail} style={{marginTop: -8, marginBottom: 16}}>
							La livraison offerte se juge sur le panier <strong>après</strong> réduction :
							un code de 10 € sur un panier de 55 € le fait retomber à 45 €.
						</p>

						<Bouton />
					</form>
				</div>
			)}

			<div className={styles.tableauCadre}>
				<div className={styles.filtres}>
					<span className={styles.celluleDiscrete} style={{fontSize: 13}}>
						{promos.length} code{promos.length > 1 ? 's' : ''}
					</span>

					<button
						type='button'
						className='btn btn-secondary'
						onClick={() => {
							setType('PERCENT');
							setEnEdition({...CODE_VIERGE});
						}}
						style={{marginLeft: 'auto', gap: 8, fontSize: 13.5, padding: '8px 14px'}}>
						<Plus size={15} strokeWidth={2.75} />
						Nouveau code
					</button>
				</div>

				{promos.length === 0 ? (
					<p className={styles.vide}>Aucun code pour l’instant.</p>
				) : (
					<div className={styles.tableauDefile}>
						<table className={styles.tableau}>
							<thead>
								<tr>
									<th>Code</th>
									<th>Réduction</th>
									<th>Minimum</th>
									<th>Validité</th>
									<th>Utilisé</th>
									<th>État</th>
									<th className={styles.celluleActions}>Actions</th>
								</tr>
							</thead>
							<tbody>
								{promos.map((promo) => (
									<tr key={promo.id}>
										<td className={styles.cellulePrincipale}>
											{promo.code}
											{promo.description && (
												<span className={styles.celluleDiscrete}>
													{' '}
													· {promo.description}
												</span>
											)}
										</td>
										<td className={styles.celluleMontant}>{libelleValeur(promo)}</td>
										<td className={styles.celluleDiscrete}>
											{promo.minSubtotalCents
												? formatPrix(promo.minSubtotalCents)
												: '—'}
										</td>
										<td className={styles.celluleDiscrete}>
											{promo.endsAt
												? `jusqu’au ${new Date(promo.endsAt).toLocaleDateString('fr-FR')}`
												: 'sans limite'}
										</td>
										<td className={styles.celluleDiscrete}>
											{promo.usedCount}
											{promo.maxUses !== null && ` / ${promo.maxUses}`}
										</td>
										<td className={styles.celluleDiscrete}>
											{promo.isActive ? 'Actif' : 'Désactivé'}
										</td>
										<td className={styles.celluleActions}>
											<button
												type='button'
												className='btn btn-ghost'
												onClick={() => editer(promo)}
												aria-label={`Modifier ${promo.code}`}
												style={{padding: 8}}>
												<Pencil size={15} strokeWidth={2.75} />
											</button>
											<Bascule promo={promo} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</>
	);
}
