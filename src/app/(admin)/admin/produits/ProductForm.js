'use client';

import {useActionState, useState} from 'react';
import Link from 'next/link';
import {useFormStatus} from 'react-dom';
import {Plus, Trash2} from 'lucide-react';
import {sauvegarderProduit} from './actions';
import styles from '../../admin.module.css';

/* Saisie d'un produit.

   Composant client pour une seule raison : les variantes et les photos
   s'ajoutent et se retirent à l'écran, ce qu'un formulaire purement serveur ne
   sait pas faire sans recharger la page à chaque ligne.

   Les lignes sont postées en tableaux parallèles (`varianteId[]`,
   `variantePrix[]`…) — la façon native du navigateur d'envoyer une liste. Les
   nouvelles lignes ont un identifiant vide : c'est ce qui distingue « créer »
   de « modifier » côté serveur.

   Aucune validation n'est faite ici pour de bon : les messages affichés
   viennent du serveur, qui reste seul juge. Ce qui se passe dans ce fichier ne
   sert qu'à guider la saisie. */

const ETAT_INITIAL = {statut: 'vierge'};

const VARIANTE_VIERGE = {id: '', nom: 'Standard', sku: '', prix: '', stock: '0', etat: 'EN_VENTE'};

function Enregistrer({creation}) {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-primary'
			style={{padding: '12px 24px'}}>
			{pending ? 'Enregistrement…' : creation ? 'Créer le produit' : 'Enregistrer'}
		</button>
	);
}

export default function ProductForm({produit, referentiels}) {
	const [etat, action] = useActionState(sauvegarderProduit, ETAT_INITIAL);
	const creation = !produit;

	const [variantes, setVariantes] = useState(() =>
		produit?.variants?.length
			? produit.variants.map((variante) => ({
					id: variante.id,
					nom: variante.name,
					sku: variante.sku,
					// Les centimes ne remontent jamais tels quels à l'écran : on saisit
					// des euros, avec la virgule française.
					prix: (variante.priceCents / 100).toFixed(2).replace('.', ','),
					stock: String(variante.stock),
					etat: variante.isActive ? 'EN_VENTE' : 'SUSPENDUE',
				}))
			: [{...VARIANTE_VIERGE}],
	);

	const [images, setImages] = useState(() =>
		produit?.images?.length
			? produit.images.map((image) => ({url: image.url, alt: image.alt ?? ''}))
			: [{url: '', alt: ''}],
	);

	const erreurs = etat.erreurs ?? {};

	const publicationInitiale = !produit
		? 'BROUILLON'
		: produit.archivedAt
			? 'DESACTIVE'
			: !produit.isActive
				? 'DESACTIVE'
				: produit.publishedAt && produit.publishedAt <= new Date()
					? 'EN_LIGNE'
					: 'BROUILLON';

	function majVariante(index, champ, valeur) {
		setVariantes((lignes) =>
			lignes.map((ligne, i) => (i === index ? {...ligne, [champ]: valeur} : ligne)),
		);
	}

	function majImage(index, champ, valeur) {
		setImages((lignes) =>
			lignes.map((ligne, i) => (i === index ? {...ligne, [champ]: valeur} : ligne)),
		);
	}

	return (
		<form action={action} className={styles.detail}>
			{produit && <input type='hidden' name='id' value={produit.id} />}

			<div className={styles.colonne}>
				<div className={styles.carte}>
					<h2 className={styles.carteTitre}>L’essentiel</h2>

					{etat.statut === 'erreur' && (
						<p className={styles.erreur} role='alert'>
							{etat.message}
						</p>
					)}

					<label className={styles.champ}>
						Nom du produit
						<input
							className='input'
							name='nom'
							defaultValue={produit?.name ?? ''}
							required
							placeholder='Ex. Rônin des Cerisiers — 1/7'
						/>
						{erreurs.nom && <span className={styles.erreur}>{erreurs.nom}</span>}
					</label>

					<label className={styles.champ}>
						Accroche
						<input
							className='input'
							name='accroche'
							defaultValue={produit?.shortDescription ?? ''}
							placeholder='La phrase affichée sous le nom, dans les listes'
						/>
					</label>

					<label className={styles.champ}>
						Description
						<textarea
							className='input'
							name='description'
							rows={6}
							defaultValue={produit?.longDescription ?? ''}
							placeholder='Décrivez la pièce, son état, ce qui la rend spéciale…'
							style={{resize: 'vertical', fontFamily: 'inherit'}}
						/>
					</label>
				</div>

				<div className={styles.carte}>
					<h2 className={styles.carteTitre}>Variantes, prix et stock</h2>

					<p className={styles.kpiDetail} style={{marginBottom: 16}}>
						Un produit sans déclinaison garde une seule variante nommée
						« Standard ». C’est elle qui porte le prix et le stock.
					</p>

					{erreurs.variantes && <p className={styles.erreur}>{erreurs.variantes}</p>}

					{variantes.map((variante, index) => (
						<div
							key={variante.id || `nouvelle-${index}`}
							style={{
								display: 'grid',
								gridTemplateColumns: '1.2fr 1fr 0.8fr 0.7fr 1fr auto',
								gap: 10,
								alignItems: 'end',
								marginBottom: 14,
							}}>
							<input type='hidden' name='varianteId' value={variante.id} />

							<label className={styles.champ} style={{marginBottom: 0}}>
								Nom
								<input
									className='input'
									name='varianteNom'
									value={variante.nom}
									onChange={(e) => majVariante(index, 'nom', e.target.value)}
								/>
							</label>

							<label className={styles.champ} style={{marginBottom: 0}}>
								SKU
								<input
									className='input'
									name='varianteSku'
									value={variante.sku}
									onChange={(e) => majVariante(index, 'sku', e.target.value)}
									placeholder='Généré si vide'
								/>
							</label>

							<label className={styles.champ} style={{marginBottom: 0}}>
								Prix (€)
								<input
									className='input'
									name='variantePrix'
									value={variante.prix}
									onChange={(e) => majVariante(index, 'prix', e.target.value)}
									placeholder='74,90'
									inputMode='decimal'
								/>
							</label>

							<label className={styles.champ} style={{marginBottom: 0}}>
								Stock
								<input
									className='input'
									name='varianteStock'
									value={variante.stock}
									onChange={(e) => majVariante(index, 'stock', e.target.value)}
									inputMode='numeric'
								/>
							</label>

							<label className={styles.champ} style={{marginBottom: 0}}>
								État
								{/* Un select et non une case à cocher : une case décochée
								    n'est pas envoyée par le navigateur, ce qui décalerait
								    les tableaux parallèles d'une ligne à l'autre. */}
								<select
									className='input'
									name='varianteEtat'
									value={variante.etat}
									onChange={(e) => majVariante(index, 'etat', e.target.value)}>
									<option value='EN_VENTE'>En vente</option>
									<option value='SUSPENDUE'>Suspendue</option>
								</select>
							</label>

							<button
								type='button'
								className='btn btn-ghost'
								aria-label='Retirer cette variante'
								disabled={variantes.length === 1}
								onClick={() =>
									setVariantes((lignes) => lignes.filter((_, i) => i !== index))
								}
								style={{padding: 10}}>
								<Trash2 size={16} strokeWidth={2.75} />
							</button>

							{(erreurs[`variante.${index}.prix`] ||
								erreurs[`variante.${index}.stock`]) && (
								<span className={styles.erreur} style={{gridColumn: '1 / -1'}}>
									{erreurs[`variante.${index}.prix`] ??
										erreurs[`variante.${index}.stock`]}
								</span>
							)}
						</div>
					))}

					<button
						type='button'
						className='btn btn-secondary'
						onClick={() => setVariantes((lignes) => [...lignes, {...VARIANTE_VIERGE}])}
						style={{gap: 8, fontSize: 13.5, padding: '9px 16px'}}>
						<Plus size={16} strokeWidth={2.75} />
						Ajouter une variante
					</button>
				</div>

				<div className={styles.carte}>
					<h2 className={styles.carteTitre}>Photos</h2>

					{/* Pas de téléversement tant qu'aucun stockage de fichiers n'est
					    branché : un dossier local disparaît au premier déploiement. En
					    attendant, l'adresse d'une image déjà en ligne fait le travail. */}
					<p className={styles.kpiDetail} style={{marginBottom: 16}}>
						Collez l’adresse de vos images. La première sert de couverture. Le
						téléversement direct arrivera avec l’espace de stockage.
					</p>

					{images.map((image, index) => (
						<div
							key={index}
							style={{
								display: 'grid',
								gridTemplateColumns: '1.4fr 1fr auto',
								gap: 10,
								alignItems: 'end',
								marginBottom: 12,
							}}>
							<label className={styles.champ} style={{marginBottom: 0}}>
								Adresse de l’image
								<input
									className='input'
									name='imageUrl'
									value={image.url}
									onChange={(e) => majImage(index, 'url', e.target.value)}
									placeholder='https://…'
								/>
							</label>

							<label className={styles.champ} style={{marginBottom: 0}}>
								Description (accessibilité)
								<input
									className='input'
									name='imageAlt'
									value={image.alt}
									onChange={(e) => majImage(index, 'alt', e.target.value)}
									placeholder='Ce que montre la photo'
								/>
							</label>

							<button
								type='button'
								className='btn btn-ghost'
								aria-label='Retirer cette photo'
								onClick={() => setImages((lignes) => lignes.filter((_, i) => i !== index))}
								style={{padding: 10}}>
								<Trash2 size={16} strokeWidth={2.75} />
							</button>

							{erreurs[`image.${index}`] && (
								<span className={styles.erreur} style={{gridColumn: '1 / -1'}}>
									{erreurs[`image.${index}`]}
								</span>
							)}
						</div>
					))}

					<button
						type='button'
						className='btn btn-secondary'
						onClick={() => setImages((lignes) => [...lignes, {url: '', alt: ''}])}
						style={{gap: 8, fontSize: 13.5, padding: '9px 16px'}}>
						<Plus size={16} strokeWidth={2.75} />
						Ajouter une photo
					</button>
				</div>
			</div>

			<div className={styles.colonne}>
				<div className={styles.carte}>
					<h2 className={styles.carteTitre}>Publication</h2>

					<label className={styles.champ}>
						État de publication
						<select
							className='input'
							name='publication'
							defaultValue={publicationInitiale}>
							<option value='BROUILLON'>Brouillon — invisible en boutique</option>
							<option value='EN_LIGNE'>En ligne — visible et achetable</option>
							<option value='DESACTIVE'>Désactivé — retiré de la vente</option>
						</select>
					</label>

					<label className={styles.champ}>
						Type
						<select className='input' name='kind' defaultValue={produit?.kind ?? 'PHYSICAL'}>
							<option value='PHYSICAL'>Physique — à expédier</option>
							<option value='DIGITAL'>Numérique — à télécharger</option>
						</select>
					</label>

					<label className={styles.champ}>
						État de la pièce
						<select
							className='input'
							name='condition'
							defaultValue={produit?.condition ?? 'NEW'}>
							<option value='NEW'>Neuf</option>
							<option value='USED'>Occasion</option>
						</select>
					</label>

					<label
						className={styles.champ}
						style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
						<input
							type='checkbox'
							name='precommande'
							defaultChecked={produit?.allowPreorder ?? false}
							style={{width: 18, height: 18, accentColor: 'var(--color-accent)'}}
						/>
						Proposé en précommande
					</label>

					{/* Ne change rien à la vente : c'est à la préparation que la case
					    compte, en faisant apparaître la saisie du contenu sur la fiche
					    de commande. */}
					<label
						className={styles.champ}
						style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
						<input
							type='checkbox'
							name='boxSurprise'
							defaultChecked={produit?.isMysteryBox ?? false}
							style={{width: 18, height: 18, accentColor: 'var(--color-accent)'}}
						/>
						Box surprise — je noterai son contenu à la préparation
					</label>
				</div>

				<div className={styles.carte}>
					<h2 className={styles.carteTitre}>Classement</h2>

					<label className={styles.champ}>
						Rayon
						<select
							className='input'
							name='categorieId'
							defaultValue={produit?.primaryCategoryId ?? ''}>
							<option value=''>— Aucun —</option>
							{referentiels.categories.map((categorie) => (
								<option key={categorie.id} value={categorie.id}>
									{categorie.name}
								</option>
							))}
						</select>
					</label>

					<label className={styles.champ}>
						Marque
						<select className='input' name='marqueId' defaultValue={produit?.brandId ?? ''}>
							<option value=''>— Aucune —</option>
							{referentiels.marques.map((marque) => (
								<option key={marque.id} value={marque.id}>
									{marque.name}
								</option>
							))}
						</select>
					</label>

					<label className={styles.champ}>
						Licence
						<select
							className='input'
							name='licenceId'
							defaultValue={produit?.licenceId ?? ''}>
							<option value=''>— Aucune —</option>
							{referentiels.licences.map((licence) => (
								<option key={licence.id} value={licence.id}>
									{licence.name}
								</option>
							))}
						</select>
					</label>
				</div>

				<div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
					<Enregistrer creation={creation} />
					<Link href='/admin/produits' className='btn btn-ghost' style={{padding: '12px 20px'}}>
						Annuler
					</Link>
				</div>
			</div>
		</form>
	);
}
