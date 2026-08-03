'use client';

import {useActionState, useState} from 'react';
import {useFormStatus} from 'react-dom';
import {MailCheck} from 'lucide-react';
import {seConnecter, sInscrire} from './actions';
import styles from './compte.module.css';

/* Connexion et inscription.

   Un seul écran à deux onglets, comme au design. Chaque onglet a son propre
   `useActionState` : partager un état ferait remonter l'erreur de connexion
   au-dessus du formulaire d'inscription.

   Le champ mot de passe n'est jamais repeuplé après une erreur — c'est le
   comportement attendu d'un navigateur, et un mot de passe qui revient du
   serveur est un mot de passe qui a traversé le réseau une fois de trop. */

const ETAT_INITIAL = {statut: 'vierge'};

function Bouton({libelle}) {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-primary btn-block'
			style={{padding: 12, fontSize: 15, marginTop: 6}}>
			{pending ? 'Un instant…' : libelle}
		</button>
	);
}

export default function AuthPanel({suite = null}) {
	const [onglet, setOnglet] = useState('connexion');
	const [etatConnexion, actionConnexion] = useActionState(seConnecter, ETAT_INITIAL);
	const [etatInscription, actionInscription] = useActionState(sInscrire, ETAT_INITIAL);

	const erreursInscription = etatInscription.erreurs ?? {};

	if (etatInscription.statut === 'a-verifier') {
		return (
			<div className={styles.carteAuth}>
				<span className={styles.iconeMail}>
					<MailCheck size={30} strokeWidth={2.5} />
				</span>
				<h1 className={styles.titreAuth}>Vérifiez votre boîte mail</h1>
				<p className={styles.texteAuth}>
					Si cette adresse n&apos;était pas déjà utilisée, votre compte est créé. Un
					message vient de partir pour confirmer.
				</p>
			</div>
		);
	}

	return (
		<div className={styles.carteAuth}>
			<h1 className={styles.titreAuth}>Mon compte</h1>

			{/* Vrais boutons dans un groupe d'onglets : la navigation par flèches et
			    l'annonce « onglet 1 sur 2 » viennent des rôles ARIA. */}
			<div className={styles.onglets} role='tablist'>
				<button
					type='button'
					role='tab'
					aria-selected={onglet === 'connexion'}
					onClick={() => setOnglet('connexion')}
					className={`${styles.onglet} ${onglet === 'connexion' ? styles.ongletActif : ''}`}>
					Connexion
				</button>
				<button
					type='button'
					role='tab'
					aria-selected={onglet === 'inscription'}
					onClick={() => setOnglet('inscription')}
					className={`${styles.onglet} ${
						onglet === 'inscription' ? styles.ongletActif : ''
					}`}>
					Inscription
				</button>
			</div>

			{onglet === 'connexion' ? (
				<form action={actionConnexion} className={styles.formulaire}>
					{/* Destination d'après-connexion, quand on arrive d'une page
					    protégée. Le chemin a déjà été validé côté serveur. */}
					{suite && <input type='hidden' name='suite' value={suite} />}

					<label className='field'>
						<span>E-mail</span>
						<input
							className={`input ${styles.champ}`}
							type='email'
							name='email'
							required
							autoComplete='email'
							defaultValue={etatConnexion.email ?? ''}
							placeholder='vous@exemple.fr'
						/>
					</label>

					<label className='field'>
						<span>Mot de passe</span>
						<input
							className={`input ${styles.champ}`}
							type='password'
							name='motDePasse'
							required
							autoComplete='current-password'
						/>
					</label>

					{etatConnexion.statut === 'erreur' && (
						<p className={styles.erreur} role='alert'>
							{etatConnexion.message}
						</p>
					)}

					<Bouton libelle='Se connecter' />

					<p className={styles.oubli}>
						Mot de passe oublié ? Le parcours de réinitialisation arrive bientôt —
						écrivez-moi en attendant.
					</p>
				</form>
			) : (
				<form action={actionInscription} className={styles.formulaire}>
					<label className='field'>
						<span>Prénom</span>
						<input
							className={`input ${styles.champ}`}
							name='prenom'
							autoComplete='given-name'
							defaultValue={etatInscription.prenom ?? ''}
							placeholder='Camille'
						/>
					</label>

					<label className='field'>
						<span>E-mail</span>
						<input
							className={`input ${styles.champ}`}
							type='email'
							name='email'
							required
							autoComplete='email'
							defaultValue={etatInscription.email ?? ''}
							placeholder='vous@exemple.fr'
							aria-invalid={erreursInscription.email ? 'true' : undefined}
						/>
						{erreursInscription.email && (
							<span className={styles.erreurChamp}>{erreursInscription.email}</span>
						)}
					</label>

					<label className='field'>
						<span>Mot de passe</span>
						<input
							className={`input ${styles.champ}`}
							type='password'
							name='motDePasse'
							required
							autoComplete='new-password'
							aria-invalid={erreursInscription.motDePasse ? 'true' : undefined}
							aria-describedby='aide-mdp'
						/>
						<span id='aide-mdp' className={styles.aide}>
							Au moins 10 caractères. Une phrase dont vous vous souvenez vaut mieux
							qu&apos;un mot compliqué.
						</span>
						{erreursInscription.motDePasse && (
							<span className={styles.erreurChamp}>{erreursInscription.motDePasse}</span>
						)}
					</label>

					<label className={styles.caseACocher}>
						<input type='checkbox' name='newsletter' />
						<span>Je veux la lettre de l&apos;antre (nouveautés, box du mois).</span>
					</label>

					<Bouton libelle='Créer mon compte' />
				</form>
			)}
		</div>
	);
}
