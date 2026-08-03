import 'server-only';
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {prisma} from '@/server/db';

/* Jetons à usage unique envoyés par e-mail.

   Un mécanisme, deux usages : réinitialiser un mot de passe, vérifier une
   adresse. Les faire vivre au même endroit évite qu'un des deux hérite d'une
   durée de vie ou d'une vérification plus faible que l'autre — c'est toujours
   celui qu'on écrit en second qui est bâclé.

   Quatre propriétés, chacune contre un scénario précis.

   **Aléatoire, 32 octets.** Un jeton devinable vaut un mot de passe partagé.

   **Stocké haché.** Comme un mot de passe : une copie de la base ne permet pas
   de forger un lien de réinitialisation. SHA-256 suffit ici, contrairement aux
   mots de passe — un jeton de 32 octets aléatoires n'a rien d'un secret
   devinable par force brute, il n'y a donc pas besoin d'une fonction lente.

   **Court.** Une heure pour reprendre la main sur un compte, un jour pour
   confirmer une adresse. Un lien qui traîne dans une boîte mail est une clé
   oubliée sous le paillasson.

   **À usage unique.** `usedAt` ferme le jeton dès qu'il a servi. */

const DUREES_MINUTES = {
	PASSWORD_RESET: 60,
	EMAIL_VERIFY: 60 * 24,
};

function empreinte(jeton) {
	return createHash('sha256').update(jeton).digest('hex');
}

/* Crée un jeton et renvoie sa version en clair — la seule fois où elle existe.

   Les jetons précédents du même usage sont fermés au passage : demander un
   second lien de réinitialisation doit invalider le premier, sinon un lien
   intercepté reste valable pendant que l'utilisateur croit l'avoir remplacé. */
export async function creerJeton(userId, purpose) {
	const jeton = randomBytes(32).toString('base64url');

	const expiration = new Date();
	expiration.setMinutes(expiration.getMinutes() + (DUREES_MINUTES[purpose] ?? 60));

	await prisma.$transaction([
		prisma.verificationToken.updateMany({
			where: {userId, purpose, usedAt: null},
			data: {usedAt: new Date()},
		}),
		prisma.verificationToken.create({
			data: {userId, purpose, tokenHash: empreinte(jeton), expiresAt: expiration},
		}),
	]);

	return jeton;
}

/* Vérifie un jeton et le consomme. Renvoie l'identifiant du compte, ou `null`.

   La consommation fait partie de la vérification, dans la même transaction :
   deux requêtes simultanées avec le même lien ne doivent pas passer toutes les
   deux. C'est ce qui empêche un lien intercepté d'être rejoué juste après un
   usage légitime.

   Un jeton expiré, déjà utilisé ou inconnu donne exactement la même réponse. */
export async function consommerJeton(jetonBrut, purpose) {
	if (typeof jetonBrut !== 'string' || jetonBrut.length === 0) return null;

	const hash = empreinte(jetonBrut);

	const enregistrement = await prisma.verificationToken.findUnique({where: {tokenHash: hash}});

	if (!enregistrement) return null;
	if (enregistrement.purpose !== purpose) return null;
	if (enregistrement.usedAt) return null;
	if (enregistrement.expiresAt < new Date()) return null;

	/* Comparaison à temps constant sur l'empreinte. La recherche par index a
	   déjà tranché ; c'est une ceinture en plus des bretelles, sans coût. */
	const attendu = Buffer.from(enregistrement.tokenHash, 'hex');
	const fourni = Buffer.from(hash, 'hex');

	if (attendu.length !== fourni.length || !timingSafeEqual(attendu, fourni)) return null;

	/* `updateMany` avec `usedAt: null` dans la clause : si deux requêtes arrivent
	   ensemble, une seule verra `count === 1`. La condition et l'écriture sont
	   évaluées en une opération par PostgreSQL, il n'y a pas d'intervalle
	   exploitable entre les deux. */
	const consomme = await prisma.verificationToken.updateMany({
		where: {id: enregistrement.id, usedAt: null},
		data: {usedAt: new Date()},
	});

	if (consomme.count !== 1) return null;

	return enregistrement.userId;
}

/// Ménage des jetons expirés ou consommés depuis longtemps. À appeler d'un
/// travail programmé le jour où il y en aura un ; sans lui la table grossit
/// lentement, sans conséquence de sécurité.
export async function purgerJetons(joursConserves = 30) {
	const limite = new Date();
	limite.setDate(limite.getDate() - joursConserves);

	const {count} = await prisma.verificationToken.deleteMany({
		where: {OR: [{expiresAt: {lt: limite}}, {usedAt: {lt: limite}}]},
	});

	return count;
}
