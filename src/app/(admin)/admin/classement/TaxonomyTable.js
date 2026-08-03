'use client';

import {useActionState, useState} from 'react';
import {useFormStatus} from 'react-dom';
import {Pencil, Plus, X} from 'lucide-react';
import {basculerEntree, sauvegarderEntree} from './actions';
import {pluriel} from '@/lib/format';
import styles from '../../admin.module.css';

/* Rayons, marques et licences.

   Le même tableau pour les trois : ils ont la même forme, et l'écran s'adapte
   au type reçu. Un composant par type aurait triplé le code pour la seule
   différence d'un intitulé.

   La colonne « produits » n'est pas informative par hasard : c'est elle qui
   permet de décider si désactiver un rayon va vider une partie de la boutique. */

const ETAT_INITIAL = {statut: 'vierge'};

function Bouton({children}) {
	const {pending} = useFormStatus();

	return (
		<button type='submit' disabled={pending} className='btn btn-primary' style={{padding: '10px 20px'}}>
			{pending ? 'Enregistrement…' : children}
		</button>
	);
}

function Bascule({type, entree}) {
	const [, action] = useActionState(basculerEntree, ETAT_INITIAL);

	return (
		<form action={action} style={{display: 'inline'}}>
			<input type='hidden' name='type' value={type} />
			<input type='hidden' name='id' value={entree.id} />
			<input type='hidden' name='actif' value={entree.actif ? '0' : '1'} />
			<button type='submit' className='btn btn-ghost' style={{padding: '6px 12px', fontSize: 13}}>
				{entree.actif ? 'Masquer' : 'Afficher'}
			</button>
		</form>
	);
}

export default function TaxonomyTable({type, libelle, entrees}) {
	const [etat, action] = useActionState(sauvegarderEntree, ETAT_INITIAL);
	const [enEdition, setEnEdition] = useState(null);

	return (
		<>
			{enEdition && (
				<div className={styles.carte} style={{marginBottom: 20}}>
					<div className={styles.kpiEntete}>
						<h2 className={styles.carteTitre} style={{margin: 0}}>
							{enEdition.id ? `Modifier — ${enEdition.nom}` : `Nouveau — ${libelle}`}
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
						<input type='hidden' name='type' value={type} />
						<input type='hidden' name='id' value={enEdition.id} />

						<div
							style={{
								display: 'grid',
								gridTemplateColumns: type === 'rayon' ? '2fr 1fr' : '1fr',
								gap: 14,
							}}>
							<label className={styles.champ}>
								Nom
								<input className='input' name='nom' defaultValue={enEdition.nom} required />
								{etat.erreurs?.nom && (
									<span className={styles.erreur}>{etat.erreurs.nom}</span>
								)}
							</label>

							{/* L'ordre ne concerne que les rayons : ce sont les seuls à
							    s'afficher en menu, où leur suite a du sens. */}
							{type === 'rayon' && (
								<label className={styles.champ}>
									Ordre d’affichage
									<input
										className='input'
										name='position'
										defaultValue={enEdition.position}
										inputMode='numeric'
									/>
								</label>
							)}
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
							Visible en boutique
						</label>

						<Bouton>Enregistrer</Bouton>
					</form>
				</div>
			)}

			<div className={styles.tableauCadre}>
				<div className={styles.filtres}>
					<span className={styles.celluleDiscrete} style={{fontSize: 13}}>
						{entrees.length} {pluriel(entrees.length, 'entrée', 'entrées')}
					</span>

					<button
						type='button'
						className='btn btn-secondary'
						onClick={() => setEnEdition({id: '', nom: '', actif: true, position: 0})}
						style={{marginLeft: 'auto', gap: 8, fontSize: 13.5, padding: '8px 14px'}}>
						<Plus size={15} strokeWidth={2.75} />
						Ajouter
					</button>
				</div>

				{entrees.length === 0 ? (
					<p className={styles.vide}>Rien pour l’instant.</p>
				) : (
					<div className={styles.tableauDefile}>
						<table className={styles.tableau}>
							<thead>
								<tr>
									<th>Nom</th>
									<th>Adresse</th>
									<th>Produits</th>
									<th>État</th>
									<th className={styles.celluleActions}>Actions</th>
								</tr>
							</thead>
							<tbody>
								{entrees.map((entree) => (
									<tr key={entree.id}>
										<td className={styles.cellulePrincipale}>{entree.nom}</td>
										<td className={styles.celluleDiscrete}>{entree.slug}</td>
										<td className={styles.celluleDiscrete}>{entree.produits}</td>
										<td className={styles.celluleDiscrete}>
											{entree.actif ? 'Visible' : 'Masqué'}
										</td>
										<td className={styles.celluleActions}>
											<button
												type='button'
												className='btn btn-ghost'
												onClick={() => setEnEdition(entree)}
												aria-label={`Modifier ${entree.nom}`}
												style={{padding: 8}}>
												<Pencil size={15} strokeWidth={2.75} />
											</button>
											<Bascule type={type} entree={entree} />
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
