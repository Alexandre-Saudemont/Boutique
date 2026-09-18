import {LIBELLES_STATUT} from '@/server/services/orders';
import styles from './StatutCommande.module.css';

/* Le bandeau de couleur d'une commande.

   But : repérer d'un coup d'œil, dans une liste de vingt lignes, ce qui
   attend d'être préparé de ce qui est déjà parti — sans avoir à lire chaque
   libellé. Les couleurs suivent une logique, pas un choix arbitraire :

   - **gris** pour ce qui n'a pas encore commencé ou qui s'est arrêté (en
     attente, annulée, remboursée) ;
   - **terracotta** (`--color-accent`) pour ce qui se prépare encore côté
     boutique, de plus en plus soutenu à mesure que ça avance (payée →
     préparation) ;
   - **sauge** (`--color-accent-2`) une fois que le colis a quitté l'atelier,
     de plus en plus soutenu jusqu'à la livraison.

   Seuls les tokens d'`organic.css` sont utilisés (voir CLASSE_STATUT
   ci-dessous) : aucune couleur n'est écrite en dur ici, pour rester fidèle au
   design remis par le client quel qu'en soit l'avenir. */
const CLASSE_STATUT = {
	PENDING_PAYMENT: styles.enAttente,
	PAID: styles.payee,
	PREPARING: styles.preparation,
	PARTIALLY_SHIPPED: styles.partielle,
	SHIPPED: styles.expediee,
	DELIVERED: styles.livree,
	CANCELLED: styles.annulee,
	REFUNDED: styles.remboursee,
};

export default function StatutCommande({statut}) {
	return (
		<span className={`${styles.badge} ${CLASSE_STATUT[statut] ?? styles.enAttente}`}>
			{LIBELLES_STATUT[statut] ?? statut}
		</span>
	);
}
