'use client';

import {useActionState, useState} from 'react';
import Link from 'next/link';
import {useFormStatus} from 'react-dom';
import {formatPrix, formatPoids} from '@/lib/format';
import {appliquerSoldeLot, appliquerStockLot, retirerSoldeLot} from './actions';
import styles from '../../admin.module.css';

/* Le tableau de l'inventaire, avec ses cases à cocher et sa barre d'actions
   groupées.

   Composant client pour une seule raison : la sélection (quelles lignes sont
   cochées) est un état d'écran, pas une donnée à faire aller-retour au
   serveur à chaque case cliquée. Les données du tableau, elles, restent
   entièrement lues côté serveur par la page — ce composant ne fait que les
   afficher et les cocher.

   Sans droit de gestion (`peutGerer` faux), aucune case n'apparaît : la
   consultation seule ne propose pas d'action qu'elle ne pourrait pas mener à
   son terme. */

const ETAT_INITIAL = {statut: 'vierge'};

function BoutonLot({children}) {
	const {pending} = useFormStatus();

	return (
		<button type='submit' disabled={pending} className='btn btn-secondary' style={{fontSize: 13}}>
			{pending ? 'Application…' : children}
		</button>
	);
}

export default function InventaireTableau({produits, peutGerer}) {
	const [selection, setSelection] = useState(() => new Set());

	const [etatStock, actionStock] = useActionState(appliquerStockLot, ETAT_INITIAL);
	const [etatSolde, actionSolde] = useActionState(appliquerSoldeLot, ETAT_INITIAL);
	const [etatRetraitSolde, actionRetraitSolde] = useActionState(retirerSoldeLot, ETAT_INITIAL);

	const [stockLot, setStockLot] = useState('');
	const [reductionLot, setReductionLot] = useState('');

	function basculer(id) {
		setSelection((precedente) => {
			const suivante = new Set(precedente);
			if (suivante.has(id)) suivante.delete(id);
			else suivante.add(id);
			return suivante;
		});
	}

	function toutBasculer() {
		setSelection((precedente) =>
			precedente.size === produits.length ? new Set() : new Set(produits.map((p) => p.id)),
		);
	}

	const idsSelectionnes = [...selection];
	const message = etatStock.message ?? etatSolde.message ?? etatRetraitSolde.message;

	return (
		<>
			{peutGerer && idsSelectionnes.length > 0 && (
				<div
					className={styles.carte}
					style={{
						display: 'flex',
						flexWrap: 'wrap',
						gap: 16,
						alignItems: 'flex-end',
						marginBottom: 14,
						padding: 14,
					}}>
					<p className={styles.kpiDetail} style={{margin: 0, alignSelf: 'center'}}>
						{idsSelectionnes.length} sélectionné(s)
					</p>

					{/* Chaque formulaire poste ses propres identifiants cachés : trois
					    actions distinctes plutôt qu'un unique gros formulaire, pour que
					    la touche Entrée dans un champ ne déclenche pas l'autre action. */}
					<form
						action={actionStock}
						style={{display: 'flex', gap: 8, alignItems: 'flex-end'}}>
						{idsSelectionnes.map((id) => (
							<input key={id} type='hidden' name='produitId' value={id} />
						))}
						<label className={styles.champ} style={{marginBottom: 0}}>
							Stock
							<input
								className='input'
								name='stock'
								value={stockLot}
								onChange={(e) => setStockLot(e.target.value)}
								placeholder='Ex. 10'
								inputMode='numeric'
								style={{width: 90}}
							/>
						</label>
						<BoutonLot>Appliquer le stock</BoutonLot>
					</form>

					<form
						action={actionSolde}
						style={{display: 'flex', gap: 8, alignItems: 'flex-end'}}>
						{idsSelectionnes.map((id) => (
							<input key={id} type='hidden' name='produitId' value={id} />
						))}
						<label className={styles.champ} style={{marginBottom: 0}}>
							Réduction (%)
							<input
								className='input'
								name='reduction'
								value={reductionLot}
								onChange={(e) => setReductionLot(e.target.value)}
								placeholder='Ex. 20'
								inputMode='numeric'
								style={{width: 90}}
							/>
						</label>
						<BoutonLot>Mettre en solde</BoutonLot>
					</form>

					<form action={actionRetraitSolde}>
						{idsSelectionnes.map((id) => (
							<input key={id} type='hidden' name='produitId' value={id} />
						))}
						<BoutonLot>Retirer le solde</BoutonLot>
					</form>
				</div>
			)}

			{message && (
				<p
					className={
						etatStock.statut === 'erreur' ||
						etatSolde.statut === 'erreur' ||
						etatRetraitSolde.statut === 'erreur'
							? styles.erreur
							: styles.succes
					}>
					{message}
				</p>
			)}

			<div className={styles.tableauDefile}>
				<table className={styles.tableau}>
					<thead>
						<tr>
							{peutGerer && (
								<th style={{width: 32}}>
									<input
										type='checkbox'
										aria-label='Tout sélectionner'
										checked={selection.size === produits.length && produits.length > 0}
										onChange={toutBasculer}
									/>
								</th>
							)}
							<th>Produit</th>
							<th>Rayon</th>
							<th>Prix</th>
							<th>Poids</th>
							<th>Stock</th>
							<th>Vues</th>
							<th>État</th>
							<th>Publication</th>
						</tr>
					</thead>
					<tbody>
						{produits.map((produit) => (
							<tr key={produit.id}>
								{peutGerer && (
									<td>
										<input
											type='checkbox'
											aria-label={`Sélectionner ${produit.nom}`}
											checked={selection.has(produit.id)}
											onChange={() => basculer(produit.id)}
										/>
									</td>
								)}
								<td className={styles.cellulePrincipale}>
									{/* Vers l'édition pour qui peut modifier, vers la fiche
									    publique pour les autres — un lien qui mène à une page
									    interdite n'apprend rien. */}
									<Link
										href={
											peutGerer
												? `/admin/produits/${produit.id}`
												: `/produit/${produit.slug}`
										}
										className={styles.lienLigne}>
										{produit.nom}
									</Link>
									{produit.nbVariantes > 1 && (
										<span className={styles.celluleDiscrete}> · {produit.nbVariantes} variantes</span>
									)}
								</td>
								<td className={styles.celluleDiscrete}>{produit.rayon ?? '—'}</td>
								<td className={styles.celluleMontant}>
									{produit.prixMinCents === null
										? '—'
										: produit.prixMinCents === produit.prixMaxCents
											? formatPrix(produit.prixMinCents)
											: `dès ${formatPrix(produit.prixMinCents)}`}
								</td>
								<td className={styles.celluleDiscrete}>
									{produit.poidsMinGrammes === null
										? '—'
										: produit.poidsMinGrammes === produit.poidsMaxGrammes
											? formatPoids(produit.poidsMinGrammes)
											: `${formatPoids(produit.poidsMinGrammes)} – ${formatPoids(produit.poidsMaxGrammes)}`}
								</td>
								<td
									style={{
										fontWeight: 600,
										color: produit.stock === 0 ? 'var(--color-accent-700)' : undefined,
									}}>
									{produit.stock}
								</td>
								<td className={styles.celluleDiscrete}>{produit.vues}</td>
								<td className={styles.celluleDiscrete}>{produit.etat.libelle}</td>
								<td className={styles.celluleDiscrete}>{produit.publication}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}
