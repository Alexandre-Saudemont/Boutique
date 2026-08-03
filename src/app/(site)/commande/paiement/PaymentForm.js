'use client';

import {useActionState, useState} from 'react';
import Link from 'next/link';
import {useFormStatus} from 'react-dom';
import {ArrowLeft, CreditCard, Info, Wallet} from 'lucide-react';
import {payerCommande} from '@/app/(site)/commande/actions';
import CartSummary from '@/components/CartSummary/CartSummary';
import styles from '../commande.module.css';

/* Choix du moyen de paiement, et validation de la commande.

   Aucun champ de carte bancaire n'est demandé, et c'est délibéré : encaisser
   soi-même un numéro de carte impose la certification PCI-DSS. Stripe et PayPal
   existent précisément pour que le numéro ne traverse jamais ce site. Quand les
   clés seront là, ce bouton redirigera vers leur page hébergée.

   En attendant, la commande est bien enregistrée — statut « en attente de
   paiement » — et le visiteur est prévenu à l'écran que rien n'est débité. */

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

function BoutonValider() {
	const {pending} = useFormStatus();

	return (
		<button
			type='submit'
			disabled={pending}
			className='btn btn-primary btn-block'
			style={{padding: 13, fontSize: 15}}>
			{pending ? 'Enregistrement…' : 'Valider ma commande'}
		</button>
	);
}

export default function PaymentForm({panier, adresse, mode}) {
	const [etat, action] = useActionState(payerCommande, ETAT_INITIAL);
	const [moyen, setMoyen] = useState('carte');

	return (
		<form action={action} className={styles.colonnes}>
			<div className={styles.contenu}>
				<div className={styles.carte}>
					<h2 className={styles.carteTitre}>Livraison</h2>

					<address className={styles.adresse}>
						{adresse.firstName} {adresse.lastName}
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
						<br />
						{adresse.email}
					</address>

					<p className={styles.modeRappel}>
						{mode.nom}
						{mode.delai ? ` · ${mode.delai}` : ''}
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
							L&apos;encaissement n&apos;est pas encore actif : votre commande sera
							enregistrée puis mise en attente de paiement, et je vous recontacterai. Aucun
							montant ne sera débité aujourd&apos;hui.
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
				livraisonCents={mode.prixCents}
				action={<BoutonValider />}
			/>
		</form>
	);
}
