'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {FileText, Trash2, Upload} from 'lucide-react';
import {retirerFichierNumerique, televerserFichierNumerique} from '../actions';
import {formatDate} from '@/lib/format';
import styles from '../../../admin.module.css';

/* Les fichiers d'un ouvrage numérique.

   Séparé du formulaire produit, et pas par goût du découpage : un téléversement
   part tout seul, tout de suite, alors que le reste de la fiche s'enregistre en
   bloc. Les mêler ferait perdre un fichier de quarante mégaoctets chaque fois
   qu'un champ est mal rempli ailleurs. */

const ETAT_INITIAL = {statut: 'vierge'};

function poidsLisible(octets) {
	const mo = octets / (1024 * 1024);
	return mo >= 1 ? `${mo.toFixed(1)} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

function BoutonEnvoyer() {
	const {pending} = useFormStatus();

	return (
		<button type='submit' disabled={pending} className='btn btn-primary'>
			<Upload size={16} strokeWidth={2.75} />
			{pending ? 'Envoi…' : 'Ajouter le fichier'}
		</button>
	);
}

function BoutonRetirer() {
	const {pending} = useFormStatus();

	return (
		<button type='submit' disabled={pending} className='btn btn-secondary' title='Retirer'>
			<Trash2 size={15} strokeWidth={2.75} />
		</button>
	);
}

export default function DigitalFiles({produitId, fichiers}) {
	const [envoi, actionEnvoi] = useActionState(televerserFichierNumerique, ETAT_INITIAL);
	const [retrait, actionRetrait] = useActionState(retirerFichierNumerique, ETAT_INITIAL);

	return (
		<section className={styles.carte}>
			<h2 className={styles.carteTitre}>Fichiers vendus</h2>

			<p className={styles.aide}>
				Ce que le client télécharge après paiement. Il reçoit un lien par e-mail,
				valable trente jours et cinq téléchargements, et retrouve le fichier sans
				limite depuis son compte.
			</p>

			{fichiers.length === 0 ? (
				<p className={styles.aide} style={{marginTop: 12}}>
					Aucun fichier pour l’instant — tant qu’il n’y en a pas, un acheteur ne
					recevrait rien.
				</p>
			) : (
				<ul className={styles.listeFichiers}>
					{fichiers.map((fichier) => (
						<li key={fichier.id} className={styles.fichier}>
							<FileText size={18} strokeWidth={2.75} />

							<span className={styles.fichierInfos}>
								<span className={styles.fichierNom}>{fichier.fileName}</span>
								<span className={styles.fichierMeta}>
									{poidsLisible(fichier.sizeBytes)} · ajouté le{' '}
									{formatDate(fichier.createdAt)}
									{fichier.ventes > 0 &&
										` · vendu ${fichier.ventes} fois`}
								</span>
							</span>

							<form action={actionRetrait}>
								<input type='hidden' name='assetId' value={fichier.id} />
								<input type='hidden' name='produitId' value={produitId} />
								<BoutonRetirer />
							</form>
						</li>
					))}
				</ul>
			)}

			{retrait.statut === 'erreur' && (
				<p className={styles.erreur} role='alert'>
					{retrait.message}
				</p>
			)}

			<form action={actionEnvoi} className={styles.formulaireFichier}>
				<input type='hidden' name='produitId' value={produitId} />

				<label className='field'>
					<span>Ajouter un fichier</span>
					<input
						className='input'
						type='file'
						name='fichier'
						required
						accept='.pdf,.epub,.zip,.png,.jpg,.jpeg,.txt'
					/>
					<span className={styles.aide}>
						PDF, EPUB, ZIP, image ou texte — 50 Mo au maximum.
					</span>
				</label>

				{envoi.statut === 'erreur' && (
					<p className={styles.erreur} role='alert'>
						{envoi.message}
					</p>
				)}

				{envoi.statut === 'ok' && (
					<p className={styles.succes} role='status'>
						Fichier ajouté.
					</p>
				)}

				<BoutonEnvoyer />
			</form>
		</section>
	);
}
