'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {archiver, restaurer} from '../actions';

/* Archiver ou remettre en brouillon.

   Séparé du grand formulaire à dessein : imbriquer deux `<form>` est interdit
   en HTML, et surtout, ces deux gestes n'ont rien à voir avec « enregistrer mes
   modifications ». Les mélanger, c'est risquer d'archiver en croyant valider.

   Aucune confirmation : rien n'est détruit. Un produit archivé se remet en
   brouillon depuis ce même bouton, et son historique de ventes est intact. */

const ETAT_INITIAL = {statut: 'vierge'};

function Bouton({archive}) {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-ghost'
			style={{padding: '10px 18px'}}>
			{pending ? 'Un instant…' : archive ? 'Remettre en brouillon' : 'Archiver'}
		</button>
	);
}

export default function ArchiveButton({id, archive}) {
	const [, action] = useActionState(archive ? restaurer : archiver, ETAT_INITIAL);

	return (
		<form action={action}>
			<input type='hidden' name='id' value={id} />
			<Bouton archive={archive} />
		</form>
	);
}
