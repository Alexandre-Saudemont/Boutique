import {beforeEach, describe, expect, it} from 'vitest';
import {ACTIONS, historique, journaliser} from '@/server/services/audit';
import {inscrire} from '@/server/services/accounts';
import {baseDisponible, prisma, viderLaBase} from './aide';

/* Journal des actions du personnel.

   Deux propriétés comptent ici, et une seule saute aux yeux. La première :
   l'action est bien consignée. La seconde, moins évidente et plus importante :
   un journal qui tombe ne doit jamais faire tomber l'action qu'il observe. */

describe.skipIf(!baseDisponible)('journalisation', () => {
	let utilisateurId;

	beforeEach(async () => {
		await viderLaBase();
		await inscrire({email: 'staff@exemple.fr', motDePasse: 'un-mot-de-passe-long'});
		const utilisateur = await prisma.user.findUnique({where: {email: 'staff@exemple.fr'}});
		utilisateurId = utilisateur.id;
	});

	it('consigne une action avec son auteur et sa cible', async () => {
		await journaliser({
			utilisateurId,
			action: ACTIONS.COMMANDE_STATUT,
			type: 'order',
			id: 'AVGF-2026-000001',
			details: {statut: 'SHIPPED'},
		});

		const [entree] = await historique('order', 'AVGF-2026-000001');

		expect(entree.action).toBe('order.status_changed');
		expect(entree.userId).toBe(utilisateurId);
		expect(entree.metadata).toEqual({statut: 'SHIPPED'});
		expect(entree.user.email).toBe('staff@exemple.fr');
	});

	it('rend l’historique du plus récent au plus ancien', async () => {
		await journaliser({utilisateurId, action: ACTIONS.COMMANDE_NOTE, type: 'order', id: 'X'});
		await journaliser({utilisateurId, action: ACTIONS.COMMANDE_STATUT, type: 'order', id: 'X'});

		const entrees = await historique('order', 'X');

		expect(entrees).toHaveLength(2);
		expect(entrees[0].action).toBe('order.status_changed');
	});

	it('ne mélange pas les historiques de deux objets', async () => {
		await journaliser({utilisateurId, action: ACTIONS.PRODUIT_ARCHIVE, type: 'product', id: 'p1'});
		await journaliser({utilisateurId, action: ACTIONS.COMMANDE_STATUT, type: 'order', id: 'p1'});

		expect(await historique('product', 'p1')).toHaveLength(1);
		expect(await historique('order', 'p1')).toHaveLength(1);
	});

	it('n’échoue pas quand l’écriture est impossible', async () => {
		/* Le cas réel : une contrainte violée, une base momentanément
		   indisponible. L'action métier a déjà eu lieu — la commande est passée en
		   « expédiée » — et perdre une ligne de journal ne doit surtout pas la
		   défaire ni afficher une erreur à qui vient de travailler. */
		await expect(
			journaliser({
				utilisateurId: 'utilisateur-qui-nexiste-pas',
				action: ACTIONS.COMMANDE_STATUT,
				type: 'order',
				id: 'X',
			}),
		).resolves.toBeUndefined();
	});

	it('accepte une action sans auteur identifié', async () => {
		// Le webhook Stripe agit sans personne derrière : la trace doit exister
		// quand même.
		await journaliser({action: ACTIONS.COMMANDE_STATUT, type: 'order', id: 'auto'});

		const [entree] = await historique('order', 'auto');
		expect(entree.userId).toBeNull();
	});

	it('survit à la suppression du compte de son auteur', async () => {
		await journaliser({utilisateurId, action: ACTIONS.PRODUIT_MODIFIE, type: 'product', id: 'p9'});

		await prisma.user.delete({where: {id: utilisateurId}});

		const [entree] = await historique('product', 'p9');
		expect(entree).toBeDefined();
		expect(entree.userId).toBeNull();
	});
});
