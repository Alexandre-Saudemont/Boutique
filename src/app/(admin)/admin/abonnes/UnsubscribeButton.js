'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {UserMinus} from 'lucide-react';
import {retirerAbonne} from './actions';

/* Retrait d'une adresse.

   Un bouton par ligne, chacun dans son formulaire : c'est la seule façon
   d'envoyer un identifiant différent par ligne sans JavaScript pour assembler
   la requête. */

const ETAT_INITIAL = {statut: 'vierge'};

function Bouton() {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-ghost'
			aria-label='Retirer de la liste'
			style={{padding: 8}}>
			<UserMinus size={15} strokeWidth={2.75} />
		</button>
	);
}

export default function UnsubscribeButton({id}) {
	const [, action] = useActionState(retirerAbonne, ETAT_INITIAL);

	return (
		<form action={action}>
			<input type='hidden' name='id' value={id} />
			<Bouton />
		</form>
	);
}
