import {Check} from 'lucide-react';
import styles from './CheckoutSteps.module.css';

/* Le fil des quatre étapes du tunnel.

   Il décrit l'avancement, il ne sert pas à naviguer : les étapes franchies
   redeviennent cliquables — revenir corriger une adresse est légitime — mais
   celles à venir ne le sont pas, on n'y accède qu'en validant la précédente.

   `<ol>` et non une suite de `<div>` : c'est une séquence ordonnée, et un
   lecteur d'écran annonce alors « étape 2 sur 4 » sans qu'on ait à l'écrire. */

const ETAPES = [
	{cle: 'panier', nom: 'Panier', href: '/panier'},
	{cle: 'livraison', nom: 'Livraison', href: '/commande/livraison'},
	{cle: 'paiement', nom: 'Paiement', href: '/commande/paiement'},
	{cle: 'confirmation', nom: 'Confirmation', href: null},
];

export default function CheckoutSteps({courante}) {
	const rangCourant = ETAPES.findIndex((etape) => etape.cle === courante);

	return (
		<ol className={styles.stepper}>
			{ETAPES.map((etape, index) => {
				const franchie = index < rangCourant;
				const active = index === rangCourant;

				const pastille = (
					<span
						className={`${styles.pastille} ${active ? styles.pastilleActive : ''} ${
							franchie ? styles.pastilleFranchie : ''
						}`}>
						{franchie ? <Check size={14} strokeWidth={3} /> : index + 1}
					</span>
				);

				const nom = (
					<span
						className={`${styles.nom} ${active ? styles.nomActif : ''} ${
							franchie ? styles.nomFranchi : ''
						}`}>
						{etape.nom}
					</span>
				);

				return (
					<li
						key={etape.cle}
						className={styles.etape}
						aria-current={active ? 'step' : undefined}>
						{franchie && etape.href ? (
							<a href={etape.href} className={styles.lien}>
								{pastille}
								{nom}
							</a>
						) : (
							<>
								{pastille}
								{nom}
							</>
						)}

						{index < ETAPES.length - 1 && (
							<span className={styles.trait} aria-hidden='true' />
						)}
					</li>
				);
			})}
		</ol>
	);
}
