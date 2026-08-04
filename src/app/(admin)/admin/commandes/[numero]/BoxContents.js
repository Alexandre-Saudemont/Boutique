'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {Package} from 'lucide-react';
import {noterContenuBox} from '../actions';
import {formatDate} from '@/lib/format';
import styles from '../../../admin.module.css';

/* Le contenu des box, noté à la préparation.

   Un cadre de texte par exemplaire vendu : commander trois box donne trois
   cadres, parce que leur contenu diffère — c'est tout l'intérêt d'une box
   surprise, et c'est ce qui permet de répondre plus tard à « moi j'avais quoi
   dedans ? ».

   Rien de tout ça ne sert à préparer la commande : celui qui emballe sait ce
   qu'il met dans le carton. C'est une note pour plus tard, écrite en dix
   secondes — d'où le texte libre plutôt qu'un inventaire ligne par ligne, qui
   serait plus propre à relire mais qu'on n'écrirait jamais. */

const ETAT_INITIAL = {statut: 'vierge'};

function BoutonNoter() {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-secondary'
			style={{padding: '9px 16px', fontSize: 14, alignSelf: 'flex-start'}}>
			{pending ? 'Enregistrement…' : 'Enregistrer'}
		</button>
	);
}

export default function BoxContents({numero, boxes, modifiable}) {
	const [etat, action] = useActionState(noterContenuBox, ETAT_INITIAL);

	return (
		<div className={styles.carte}>
			<h2 className={styles.carteTitre}>
				<Package size={17} strokeWidth={2.75} /> Contenu des box
			</h2>

			<p className={styles.aide}>
				Notez en deux mots ce que vous mettez dans chaque box en l’emballant. Ça ne
				sert pas à préparer la commande — c’est pour pouvoir répondre, des mois plus
				tard, à un client qui demande ce qu’il a reçu.
			</p>

			{etat.statut === 'erreur' && (
				<p className={styles.erreur} role='alert'>
					{etat.message}
				</p>
			)}

			{boxes.map((ligne) =>
				ligne.exemplaires.map((box) => (
					<section key={`${ligne.id}-${box.numero}`} className={styles.box}>
						<h3 className={styles.boxTitre}>
							{ligne.nom}
							{ligne.variante && ligne.variante !== 'Standard' && ` — ${ligne.variante}`}
							{ligne.exemplaires.length > 1 && ` · box ${box.numero}`}
							{box.modifieLe && (
								<span className={styles.boxDate}> · noté le {formatDate(box.modifieLe)}</span>
							)}
						</h3>

						{modifiable ? (
							<form action={action} className={styles.formulaireBox}>
								<input type='hidden' name='ligneId' value={ligne.id} />
								<input type='hidden' name='boxNumber' value={box.numero} />
								<input type='hidden' name='numero' value={numero} />

								<textarea
									className={`input ${styles.zoneBox}`}
									name='contenu'
									rows={3}
									maxLength={2000}
									defaultValue={box.contenu}
									placeholder='Tome 1 de Berserk (occasion), figurine Chopper 10 cm, 3 stickers…'
									aria-label={`Contenu de la box ${box.numero}`}
								/>

								<BoutonNoter />
							</form>
						) : box.contenu ? (
							<p className={styles.contenuBox}>{box.contenu}</p>
						) : (
							<p className={styles.aide}>Rien de noté.</p>
						)}
					</section>
				)),
			)}
		</div>
	);
}
