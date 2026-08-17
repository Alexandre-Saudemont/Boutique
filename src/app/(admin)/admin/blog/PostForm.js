'use client';

import {useActionState} from 'react';
import Link from 'next/link';
import {useFormStatus} from 'react-dom';
import {sauvegarderArticle} from './actions';
import styles from '../../admin.module.css';

/* Écriture d'un article.

   Un simple champ de texte, pas d'éditeur riche. Le contenu est affiché tel
   quel côté vitrine ; un éditeur qui produirait du HTML demanderait de le
   nettoyer au rendu, sans quoi une balise `<script>` collée depuis un autre
   site s'exécuterait chez les visiteurs. Le jour où la mise en forme sera
   nécessaire, ce sera du Markdown converti avec une liste de balises permises. */

const ETAT_INITIAL = {statut: 'vierge'};

function Enregistrer({creation}) {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-primary'
			style={{padding: '12px 24px'}}>
			{pending ? 'Enregistrement…' : creation ? 'Créer l’article' : 'Enregistrer'}
		</button>
	);
}

export default function PostForm({article}) {
	const [etat, action] = useActionState(sauvegarderArticle, ETAT_INITIAL);
	const erreurs = etat.erreurs ?? {};

	return (
		<form action={action} className={styles.detail}>
			{article && <input type='hidden' name='id' value={article.id} />}

			<div className={styles.colonne}>
				<div className={styles.carte}>
					{etat.statut === 'erreur' && (
						<p className={styles.erreur} role='alert'>
							{etat.message}
						</p>
					)}

					<label className={styles.champ}>
						Titre
						<input
							className='input'
							name='titre'
							defaultValue={article?.title ?? ''}
							required
							placeholder='Ex. Pourquoi le mécha des années 80 vieillit si bien'
						/>
						{erreurs.titre && <span className={styles.erreur}>{erreurs.titre}</span>}
					</label>

					<label className={styles.champ}>
						Chapô
						<textarea
							className='input'
							name='chapeau'
							rows={2}
							defaultValue={article?.excerpt ?? ''}
							placeholder='La phrase d’accroche affichée dans la liste des articles'
							style={{resize: 'vertical', fontFamily: 'inherit'}}
						/>
					</label>

					<label className={styles.champ}>
						Contenu
						<textarea
							className='input'
							name='contenu'
							rows={18}
							defaultValue={article?.content ?? ''}
							placeholder='Écrivez votre article ici…'
							style={{resize: 'vertical', fontFamily: 'inherit'}}
						/>
						{erreurs.contenu && <span className={styles.erreur}>{erreurs.contenu}</span>}
					</label>
				</div>
			</div>

			<div className={styles.colonne}>
				<div className={styles.carte}>
					<h2 className={styles.carteTitre}>Publication</h2>

					<label className={styles.champ}>
						État
						<select
							className='input'
							name='statut'
							defaultValue={article?.status ?? 'DRAFT'}>
							<option value='DRAFT'>Brouillon</option>
							<option value='PUBLISHED'>Publié</option>
						</select>
					</label>

					<label className={styles.champ}>
						Image de couverture
						<input
							className='input'
							name='image'
							defaultValue={article?.coverImageUrl ?? ''}
							placeholder='https://…'
						/>
					</label>
				</div>

				<div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
					<Enregistrer creation={!article} />
					<Link href='/admin/blog' className='btn btn-ghost' style={{padding: '12px 20px'}}>
						Annuler
					</Link>
				</div>
			</div>
		</form>
	);
}
