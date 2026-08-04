'use client';

import {useActionState, useState} from 'react';
import Link from 'next/link';
import {useFormStatus} from 'react-dom';
import {ArrowLeft, CreditCard, Info, Wallet} from 'lucide-react';
import {payerCommande} from '@/app/(site)/commande/actions';
import CartSummary from '@/components/CartSummary/CartSummary';
import {formatPrix} from '@/lib/format';
import styles from '../commande.module.css';

/* Choix du moyen de paiement, et validation de la commande.

   Aucun champ de carte bancaire n'est demandé, et c'est délibéré : encaisser
   soi-même un numéro de carte impose la certification PCI-DSS. Le bouton
   emmène sur la page hébergée par Stripe, où le numéro est saisi.

   Deux états, selon que les clés Stripe sont en place ou non — le texte du
   bouton et l'avertissement changent, pour que l'écran n'annonce jamais un
   débit qui n'aura pas lieu, ni l'inverse. */

const ETAT_INITIAL = {statut: 'vierge'};

const MOYENS = [
	{
		cle: 'carte',
		Icone: CreditCard,
		nom: 'Carte bancaire',
		detail: 'Visa, Mastercard, CB — via Stripe',
	},
	{
		cle: 'paypal',
		Icone: Wallet,
		nom: 'PayPal',
		detail: 'Vous serez redirigé vers PayPal',
	},
];

function BoutonValider({enLigne, totalCents}) {
	const {pending} = useFormStatus();

	const libelle = enLigne ? `Payer ${formatPrix(totalCents)}` : 'Valider ma commande';

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-primary btn-block'
			style={{padding: 13, fontSize: 15}}>
			{pending ? (enLigne ? 'Redirection…' : 'Enregistrement…') : libelle}
		</button>
	);
}

export default function PaymentForm({panier, adresse, mode, enLigne, annule}) {
	const [etat, action] = useActionState(payerCommande, ETAT_INITIAL);
	const [moyen, setMoyen] = useState('carte');

	/* `mode` est nul quand la commande est entièrement dématérialisée : il n'y a
	   pas de transporteur à rappeler, et rien à ajouter au total. */
	const totalCents = panier.sousTotalCents + (mode?.prixCents ?? 0);

	return (
		<form action={action} className={styles.colonnes}>
			<div className={styles.contenu}>
				{annule && etat.statut === 'vierge' && (
					<p className={styles.avertissement} role='status'>
						<Info size={16} strokeWidth={2.75} className={styles.avertissementIcone} />
						<span>
							Paiement interrompu — rien n&apos;a été débité et votre panier est
							intact. Vous pouvez recommencer quand vous voulez.
						</span>
					</p>
				)}

				<div className={styles.carte}>
					<h2 className={styles.carteTitre}>
						{panier.dematerialise ? 'Livraison par e-mail' : 'Livraison'}
					</h2>

					<address className={styles.adresse}>
						{adresse.firstName} {adresse.lastName}
						{!panier.dematerialise && (
							<>
								<br />
								{adresse.line1}
								{adresse.line2 && (
									<>
										<br />
										{adresse.line2}
									</>
								)}
								<br />
								{adresse.postalCode} {adresse.city}
							</>
						)}
						<br />
						{adresse.email}
					</address>

					<p className={styles.modeRappel}>
						{panier.dematerialise
							? 'Vos fichiers partent à cette adresse dès le paiement confirmé.'
							: `${mode.nom}${mode.delai ? ` · ${mode.delai}` : ''}`}
					</p>

					<Link href='/commande/livraison' className={styles.modifier}>
						Modifier
					</Link>
				</div>

				<fieldset className={styles.carte}>
					<legend className={styles.carteTitre}>Moyen de paiement</legend>

					<div className={styles.modes}>
						{MOYENS.map(({cle, Icone, nom, detail}) => (
							<label
								key={cle}
								className={`${styles.mode} ${moyen === cle ? styles.modeChoisi : ''}`}>
								<input
									type='radio'
									name='provider'
									value={cle}
									checked={moyen === cle}
									onChange={() => setMoyen(cle)}
									className={styles.radio}
								/>

								<Icone size={20} strokeWidth={2.75} className={styles.moyenIcone} />

								<span className={styles.modeInfos}>
									<span className={styles.modeNom}>{nom}</span>
									<span className={styles.modeDelai}>{detail}</span>
								</span>
							</label>
						))}
					</div>

					<p className={styles.avertissement}>
						<Info size={16} strokeWidth={2.75} className={styles.avertissementIcone} />
						<span>
							{enLigne ? (
								<>
									Le paiement se fait sur la page sécurisée de Stripe : vos
									coordonnées bancaires ne passent jamais par ce site. Vous revenez
									ici juste après.
								</>
							) : (
								<>
									L&apos;encaissement n&apos;est pas encore actif : votre commande sera
									enregistrée puis mise en attente de paiement, et je vous
									recontacterai. Aucun montant ne sera débité aujourd&apos;hui.
								</>
							)}
						</span>
					</p>
				</fieldset>

				{etat.statut === 'erreur' && (
					<p className={styles.erreurBloc} role='alert'>
						{etat.message}
					</p>
				)}

				<Link href='/commande/livraison' className={styles.retour}>
					<ArrowLeft size={16} strokeWidth={2.75} />
					Retour à la livraison
				</Link>
			</div>

			<CartSummary
				panier={panier}
				livraisonCents={mode?.prixCents ?? 0}
				action={<BoutonValider enLigne={enLigne} totalCents={totalCents} />}
			/>
		</form>
	);
}
