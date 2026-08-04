'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {Package, Plus, X} from 'lucide-react';
import {ajouterPiece, retirerPiece} from '../actions';
import styles from '../../../admin.module.css';

/* Le contenu des box, noté à la préparation.

   Un bloc par exemplaire vendu : commander deux box identiques donne deux
   listes distinctes, parce que leur contenu diffère — c'est tout l'intérêt
   d'une box surprise, et c'est ce qui permet de répondre plus tard à « moi
   j'avais quoi dedans ? ».

   Le formulaire se remet à zéro tout seul après chaque ajout (`key` sur la
   valeur d'état) : on emballe en enchaînant les pièces, sans repasser par la
   souris pour vider le champ. */

const ETAT_INITIAL = {statut: 'vierge'};

function BoutonAjouter() {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-secondary'
			style={{padding: '9px 16px', fontSize: 14}}>
			<Plus size={15} strokeWidth={2.75} />
			{pending ? 'Ajout…' : 'Ajouter'}
		</button>
	);
}

function BoutonRetirer() {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className={styles.retirerPiece}
			title='Retirer cette pièce'
			aria-label='Retirer cette pièce'>
			<X size={14} strokeWidth={2.75} />
		</button>
	);
}

export default function BoxContents({numero, boxes, modifiable}) {
	const [ajout, actionAjout] = useActionState(ajouterPiece, ETAT_INITIAL);
	const [retrait, actionRetrait] = useActionState(retirerPiece, ETAT_INITIAL);

	return (
		<div className={styles.carte}>
			<h2 className={styles.carteTitre}>
				<Package size={17} strokeWidth={2.75} /> Contenu des box
			</h2>

			<p className={styles.aide}>
				Notez ce que vous mettez dans chaque box en l’emballant. C’est la seule
				façon de répondre, des mois plus tard, à un client qui demande ce qu’il a
				reçu.
			</p>

			{(ajout.statut === 'erreur' || retrait.statut === 'erreur') && (
				<p className={styles.erreur} role='alert'>
					{ajout.message ?? retrait.message}
				</p>
			)}

			{boxes.map((ligne) =>
				ligne.exemplaires.map((box) => (
					<section key={`${ligne.id}-${box.numero}`} className={styles.box}>
						<h3 className={styles.boxTitre}>
							{ligne.nom}
							{ligne.variante && ligne.variante !== 'Standard' && ` — ${ligne.variante}`}
							{ligne.exemplaires.length > 1 && ` · box ${box.numero}`}
						</h3>

						{box.pieces.length === 0 ? (
							<p className={styles.aide}>Rien de noté pour l’instant.</p>
						) : (
							<ul className={styles.listePieces}>
								{box.pieces.map((piece) => (
									<li key={piece.id} className={styles.piece}>
										<span>
											{piece.label}
											{piece.note && (
												<span className={styles.pieceNote}> — {piece.note}</span>
											)}
										</span>

										{modifiable && (
											<form action={actionRetrait}>
												<input type='hidden' name='pieceId' value={piece.id} />
												<input type='hidden' name='numero' value={numero} />
												<BoutonRetirer />
											</form>
										)}
									</li>
								))}
							</ul>
						)}

						{modifiable && (
							<form
								action={actionAjout}
								className={styles.formulairePiece}
								key={box.pieces.length}>
								<input type='hidden' name='ligneId' value={ligne.id} />
								<input type='hidden' name='boxNumber' value={box.numero} />
								<input type='hidden' name='numero' value={numero} />

								<input
									className='input'
									name='label'
									required
									maxLength={200}
									placeholder='Figurine Chopper 10 cm, neuve'
									aria-label='Pièce mise dans la box'
								/>
								<input
									className='input'
									name='note'
									maxLength={500}
									placeholder='Précision (facultatif)'
									aria-label='Précision'
								/>

								<BoutonAjouter />
							</form>
						)}
					</section>
				)),
			)}
		</div>
	);
}
