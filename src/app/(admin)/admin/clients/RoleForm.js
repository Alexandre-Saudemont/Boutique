'use client';

import {useActionState} from 'react';
import {useFormStatus} from 'react-dom';
import {attribuerRole} from './actions';
import styles from '../../admin.module.css';

/* Changement de rôle.

   Le formulaire n'affiche aucun avertissement tant qu'on ne touche à rien, mais
   dit clairement ce qui va se passer : la personne sera déconnectée. C'est la
   surprise qu'il faut éviter — quelqu'un en pleine préparation de commandes qui
   se retrouve à la porte sans comprendre.

   Les garde-fous (dernier administrateur, son propre compte) sont côté serveur.
   Ce que l'écran en montre — les options grisées — n'est qu'un confort. */

const ETAT_INITIAL = {statut: 'vierge'};

const ROLES = [
	{valeur: 'CUSTOMER', libelle: 'Client — aucun accès au back-office'},
	{valeur: 'STAFF_ORDERS', libelle: 'Préparation — commandes et stock, sans les prix'},
	{valeur: 'STAFF_SUPPORT', libelle: 'Service client — commandes en lecture, avis'},
	{valeur: 'ADMIN', libelle: 'Administrateur — tous les droits'},
];

function Bouton() {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-secondary'
			style={{padding: '9px 16px', fontSize: 13.5}}>
			{pending ? 'Enregistrement…' : 'Changer le rôle'}
		</button>
	);
}

export default function RoleForm({client, estMoi}) {
	const [etat, action] = useActionState(attribuerRole, ETAT_INITIAL);

	if (estMoi) {
		return (
			<p className={styles.kpiDetail}>
				C’est votre compte : votre propre rôle ne se modifie pas d’ici. Un autre
				administrateur peut le faire.
			</p>
		);
	}

	return (
		<form action={action}>
			<input type='hidden' name='id' value={client.id} />

			<label className={styles.champ}>
				Rôle
				<select className='input' name='role' defaultValue={client.role}>
					{ROLES.map((role) => (
						<option key={role.valeur} value={role.valeur}>
							{role.libelle}
						</option>
					))}
				</select>
			</label>

			{etat.statut === 'erreur' && (
				<p className={styles.erreur} role='alert'>
					{etat.message}
				</p>
			)}
			{etat.statut === 'ok' && <p className={styles.succes}>{etat.message}</p>}

			<p className={styles.kpiDetail} style={{marginTop: -6, marginBottom: 14}}>
				Changer le rôle ferme les sessions ouvertes de cette personne : elle devra se
				reconnecter.
			</p>

			<Bouton />
		</form>
	);
}
