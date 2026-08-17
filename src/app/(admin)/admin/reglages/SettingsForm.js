'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {sauvegarderReglages} from './actions';
import styles from '../../admin.module.css';

/* Formulaire des réglages.

   Les champs sont rendus à partir du descripteur du serveur plutôt qu'écrits un
   à un : ajouter un réglage se fait alors en une ligne dans `settings.js`, sans
   toucher à cet écran. C'est aussi ce qui garantit que ce qui s'affiche est
   exactement ce que le serveur accepte d'enregistrer. */

const ETAT_INITIAL = {statut: 'vierge'};

function Enregistrer() {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-primary'
			style={{padding: '12px 24px'}}>
			{pending ? 'Enregistrement…' : 'Enregistrer'}
		</button>
	);
}

/// Les montants sont stockés en centimes et saisis en euros.
function centimesEnEuros(centimes) {
	return ((Number(centimes) || 0) / 100).toFixed(2).replace('.', ',');
}

/* Répartit les réglages en cartes, dans l'ordre où ils sont déclarés.

   Sans regroupement, la treizième ligne d'un formulaire d'une seule colonne se
   confond avec la première : on ne cherche plus un réglage, on le survole. Un
   descripteur sans `groupe` retombe sur « Boutique ». */
function parGroupe(descripteurs) {
	const groupes = new Map();

	for (const [cle, descripteur] of Object.entries(descripteurs)) {
		const nom = descripteur.groupe ?? 'Boutique';
		if (!groupes.has(nom)) groupes.set(nom, []);
		groupes.get(nom).push([cle, descripteur]);
	}

	return [...groupes];
}

export default function SettingsForm({descripteurs, valeurs}) {
	const [etat, action] = useActionState(sauvegarderReglages, ETAT_INITIAL);

	return (
		<form action={action} style={{maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20}}>
			{parGroupe(descripteurs).map(([groupe, champs], rang) => (
				<div key={groupe} className={styles.carte}>
					<h2 className={styles.carteTitre}>{groupe}</h2>
	
					{rang === 0 && etat.statut === 'ok' && <p className={styles.succes}>{etat.message}</p>}
	
					{champs.map(([cle, descripteur]) => (
						<div key={cle}>
							{descripteur.type === 'booleen' ? (
								<label
									className={styles.champ}
									style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
									<input
										type='checkbox'
										name={cle}
										defaultChecked={Boolean(valeurs[cle])}
										style={{width: 18, height: 18, accentColor: 'var(--color-accent)'}}
									/>
									{descripteur.libelle}
								</label>
							) : descripteur.type === 'choix' ? (
								<label className={styles.champ}>
									{descripteur.libelle}
									<select className='input' name={cle} defaultValue={valeurs[cle]}>
										{descripteur.options.map((option) => (
											<option key={option.valeur} value={option.valeur}>
												{option.libelle}
											</option>
										))}
									</select>
								</label>
							) : (
								<label className={styles.champ}>
									{descripteur.libelle}
									{descripteur.type === 'euros' ? (
										<input
											className='input'
											name={cle}
											defaultValue={centimesEnEuros(valeurs[cle])}
											inputMode='decimal'
											style={{maxWidth: 200}}
										/>
									) : (
										<input className='input' name={cle} defaultValue={valeurs[cle] ?? ''} />
									)}
								</label>
							)}
	
							{descripteur.aide && (
								<p className={styles.kpiDetail} style={{marginTop: -6, marginBottom: 16}}>
									{descripteur.aide}
								</p>
							)}
						</div>
					))}
				</div>
				))}

			<div>
				<Enregistrer />
			</div>
		</form>
	);
}
