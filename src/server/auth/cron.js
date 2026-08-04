import 'server-only';
import {timingSafeEqual} from 'node:crypto';

/* Garde du point d'entrée de ménage.

   Le ménage n'est pas une action du site : c'est un travail programmé, déclenché
   de serveur à serveur. Il lui faut donc une vraie route HTTP, et une route HTTP
   publique se trouve — les scanners essaient `/api/cron/` comme le reste.

   Rien de sensible ne fuite si quelqu'un la déclenche (elle ne fait que
   supprimer des lignes déjà périmées), mais elle écrit en base et coûte des
   requêtes : la laisser ouverte offrirait un bouton à marteler.

   **Sans secret configuré, tout est refusé.** L'inverse — accepter en l'absence
   de configuration — transformerait un oubli de variable d'environnement en
   route ouverte, et personne ne s'en apercevrait puisque le site marche.
   C'est la même règle que pour la signature des webhooks Stripe. */

const PREFIXE = 'Bearer ';

/* Comparaison à temps constant. Le secret est long et aléatoire, donc une
   attaque par mesure du temps est théorique ici ; elle ne coûte rien à écarter,
   et l'écarter évite d'avoir à juger si elle est praticable. */
function egal(a, b) {
	const gauche = Buffer.from(a, 'utf8');
	const droite = Buffer.from(b, 'utf8');
	if (gauche.length !== droite.length) return false;
	return timingSafeEqual(gauche, droite);
}

/// Vrai si l'en-tête `Authorization` porte le secret attendu.
export function autoriseCron(enTeteAuthorization, secret = process.env.CRON_SECRET) {
	if (typeof secret !== 'string' || secret.length === 0) return false;
	if (typeof enTeteAuthorization !== 'string') return false;
	if (!enTeteAuthorization.startsWith(PREFIXE)) return false;

	return egal(enTeteAuthorization.slice(PREFIXE.length), secret);
}
