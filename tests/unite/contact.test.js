import {beforeEach, describe, expect, it, vi} from 'vitest';

/* Le formulaire de contact.

   C'est le seul formulaire public du site qui déclenche un envoi d'e-mail vers
   la boîte du client. Trois choses le protègent — le champ-piège, la liste
   fermée de sujets et la limitation par adresse — et chacune se teste ici. Sans
   elles, l'adresse du Vieux geek se retrouve dans les listes de spam en une
   nuit, et c'est tout le domaine qui est classé indésirable ensuite.

   Le service est isolé de la base et du réseau : ce qu'on vérifie, ce sont ses
   règles, pas Prisma ni Resend. */

const envoyerMessageContact = vi.fn(async () => ({ok: true}));

vi.mock('@/server/email/messages', () => ({envoyerMessageContact}));

vi.mock('@/server/services/settings', () => ({
	getSettings: async () => ({'legal.email': 'vieux.geek@exemple.fr'}),
}));

const {SUJETS, envoyerDemandeContact} = await import('@/server/services/contact');
const {reinitialiserLimite} = await import('@/server/auth/rate-limit');

/// Un message valide, dont chaque test ne change que ce qui l'intéresse.
function message(modifications = {}) {
	return {
		nom: 'Camille',
		email: 'camille@exemple.fr',
		sujet: SUJETS[0],
		message: 'Bonjour, je cherche une figurine sortie en 1998, l’auriez-vous en occasion ?',
		...modifications,
	};
}

describe('envoyerDemandeContact', () => {
	beforeEach(() => {
		envoyerMessageContact.mockClear();
		// La limitation vit dans un module partagé : sans remise à zéro, le
		// quatrième test de la même adresse échouerait pour la mauvaise raison.
		reinitialiserLimite('contact:camille@exemple.fr');
	});

	it('transmet un message valide à l’adresse publiée dans les mentions légales', async () => {
		const resultat = await envoyerDemandeContact(message());

		expect(resultat.ok).toBe(true);
		expect(envoyerMessageContact).toHaveBeenCalledOnce();
		expect(envoyerMessageContact.mock.calls[0][0].destinataire).toBe('vieux.geek@exemple.fr');
	});

	it('n’envoie rien quand le champ-piège est rempli, sans le dire', async () => {
		const resultat = await envoyerDemandeContact(message({piege: 'http://spam.example'}));

		// Le robot repart avec un succès : lui signaler qu'il a été repéré, c'est
		// lui indiquer quoi corriger pour passer la fois suivante.
		expect(resultat.ok).toBe(true);
		expect(envoyerMessageContact).not.toHaveBeenCalled();
	});

	it('refuse un sujet qui ne vient pas de la liste', async () => {
		/* Le `<select>` se réécrit dans le navigateur. Sans cette vérification,
		   n'importe qui choisit la ligne d'objet des e-mails reçus par le client —
		   et y glisse ce qu'il veut. */
		const resultat = await envoyerDemandeContact(message({sujet: 'URGENT — virement à effectuer'}));

		expect(resultat.ok).toBe(false);
		expect(envoyerMessageContact).not.toHaveBeenCalled();
	});

	it('refuse une adresse e-mail invalide', async () => {
		const resultat = await envoyerDemandeContact(message({email: 'pas-une-adresse'}));

		expect(resultat.ok).toBe(false);
		expect(envoyerMessageContact).not.toHaveBeenCalled();
	});

	it('refuse un message vide ou expédié en deux mots', async () => {
		expect((await envoyerDemandeContact(message({message: ''}))).ok).toBe(false);
		expect((await envoyerDemandeContact(message({message: 'salut'}))).ok).toBe(false);
		expect(envoyerMessageContact).not.toHaveBeenCalled();
	});

	it('refuse un message à rallonge', async () => {
		const resultat = await envoyerDemandeContact(message({message: 'a'.repeat(4001)}));

		expect(resultat.ok).toBe(false);
		expect(envoyerMessageContact).not.toHaveBeenCalled();
	});

	it('coupe après trois messages de la même adresse', async () => {
		for (let envoi = 0; envoi < 3; envoi += 1) {
			expect((await envoyerDemandeContact(message())).ok).toBe(true);
		}

		const quatrieme = await envoyerDemandeContact(message());

		expect(quatrieme.ok).toBe(false);
		expect(quatrieme.erreur).toMatch(/minute/);
		expect(envoyerMessageContact).toHaveBeenCalledTimes(3);
	});

	it('prévient le visiteur quand l’envoi échoue plutôt que de le rassurer', async () => {
		envoyerMessageContact.mockResolvedValueOnce({ok: false, raison: 'injoignable'});

		const resultat = await envoyerDemandeContact(message());

		// Le message n'est stocké nulle part : annoncer « c'est parti » alors que
		// rien n'est parti ferait attendre une réponse qui ne viendra jamais.
		expect(resultat.ok).toBe(false);
	});
});
