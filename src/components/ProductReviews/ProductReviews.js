import Link from 'next/link';
import {Star} from 'lucide-react';
import {formatDate, pluriel} from '@/lib/format';
import ReviewForm from './ReviewForm';
import styles from './ProductReviews.module.css';

/* Les avis sous la fiche produit.

   Server Component : les avis viennent de la base et n'ont aucune interaction.
   Seul le formulaire de dépôt est un composant client, parce qu'il a un état —
   la note choisie — et affiche ses erreurs sans recharger.

   Le contenu des avis est rendu comme du texte, jamais interprété comme du
   HTML. C'est ce qui rend inoffensif un avis contenant des balises. */

function Etoiles({note, taille = 16}) {
	return (
		<span className={styles.etoiles} aria-label={`${note} sur 5`}>
			{[1, 2, 3, 4, 5].map((rang) => (
				<Star
					key={rang}
					size={taille}
					strokeWidth={2.75}
					fill={rang <= Math.round(note) ? 'currentColor' : 'none'}
					aria-hidden='true'
				/>
			))}
		</span>
	);
}

export default function ProductReviews({produit, avis, utilisateur, dejaDonne}) {
	return (
		<section className={styles.section} id='avis'>
			<div className={styles.entete}>
				<h2 className={styles.titre}>Avis des clients</h2>

				{avis.length > 0 && (
					<span className={styles.moyenne}>
						<Etoiles note={produit.note ?? 0} />
						{produit.note} sur 5 · {pluriel(avis.length, 'avis', 'avis')}
					</span>
				)}
			</div>

			{avis.length === 0 ? (
				<p className={styles.vide}>
					Personne n’a encore donné son avis sur cette pièce. À vous de commencer.
				</p>
			) : (
				<div className={styles.liste}>
					{avis.map((entree) => (
						<article key={entree.id} className={styles.avis}>
							<div className={styles.avisEntete}>
								<Etoiles note={entree.rating} />
								<span className={styles.auteur}>{entree.authorName}</span>
								{/* Le badge n'est posé que si une commande payée contenant
								    cette pièce existe : il ne se déclare pas. */}
								{entree.verifiedPurchase && (
									<span className={styles.verifie}>Achat vérifié</span>
								)}
								<span className={styles.date}>{formatDate(entree.createdAt)}</span>
							</div>

							{entree.title && <p className={styles.avisTitre}>{entree.title}</p>}

							<p className={styles.avisTexte}>{entree.content}</p>

							{entree.adminReply && (
								<div className={styles.reponse}>
									<span className={styles.reponseAuteur}>Réponse du Vieux geek</span>
									{entree.adminReply}
								</div>
							)}
						</article>
					))}
				</div>
			)}

			{!utilisateur ? (
				<p className={styles.invite}>
					<Link href={`/compte?suite=/produit/${produit.slug}`}>Connectez-vous</Link> pour
					laisser votre avis. C’est ce qui me permet de savoir qui parle — et d’afficher
					« achat vérifié » quand c’est le cas.
				</p>
			) : dejaDonne ? (
				<p className={styles.invite}>
					Vous avez déjà donné votre avis sur cette pièce. Merci !
				</p>
			) : (
				<ReviewForm produitId={produit.id} />
			)}
		</section>
	);
}
