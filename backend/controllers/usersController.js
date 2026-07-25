import bcrypt from 'bcryptjs';
import {PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();

// Obtenir tous les utilisateurs (admin seulement)
export const getAllUsers = async (req, res) => {
	try {
		const users = await prisma.user.findMany({
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true,
				role: true,
				createdAt: true,
			},
		});
		res.json(users);
	} catch (error) {
		console.error('Erreur lors de la récupération des utilisateurs:', error);
		res.status(500).json({error: 'Erreur lors de la récupération des utilisateurs'});
	}
};

// Obtenir un utilisateur par ID (admin ou soi-même)
// À faire : récupérer l'id depuis req.params, vérifier que l'appelant est admin OU qu'il demande son propre profil (sinon 403),
// puis findUnique par id, renvoyer 404 si pas trouvé, sinon res.json(user). Penser au try/catch et à ne pas exposer le password.
export const getUserById = async (req, res) => {
	try {
		const {id} = req.params;
		const userId = Number(id);

		if (!Number.isInteger(userId)) {
			return res.status(400).json({error: 'ID Invalide'});
		}

		// admin ou soi-même
		if (req.userRole !== 'admin' && requestedIf !== userId) {
			return res.status(403).json({error: 'Accès refusé'});
		}

		const user = await prisma.user.findUnique({
			where: {id: userID},
			select: {
				id: true,
				email: true,
				firstname: true,
				lastname: true,
				role: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		if (!user) {
			return res.status(404).json({error: 'Utilisateur non trouvé'});
		}

		return res.json(user);
	} catch (error) {
		console.error("Erreur lors de la récupération de l'utilisateur:", error);
		res.status(500).json({error: "Erreur lors de la récupération de l'utilisateur"});
	}
};

// Modifier son propre compte ou un autre compte (admin)
export const updateUser = async (req, res) => {
	try {
		const {id} = req.params;
		const userId = parseInt(id);
		const {email, firstName, lastName, password} = req.body;

		// Vérifier que l'utilisateur peut modifier ce compte
		if (req.userRole !== 'admin' && req.userId !== userId) {
			return res.status(403).json({error: 'Accès refusé'});
		}

		const updateData = {};

		if (email) {
			// Vérifier si l'email n'est pas déjà utilisé par un autre utilisateur
			const existingUser = await prisma.user.findUnique({
				where: {email},
			});
			if (existingUser && existingUser.id !== userId) {
				return res.status(400).json({error: 'Cet email est déjà utilisé'});
			}
			updateData.email = email;
		}

		if (firstName !== undefined) updateData.firstName = firstName;
		if (lastName !== undefined) updateData.lastName = lastName;

		if (password) {
			updateData.password = await bcrypt.hash(password, 10);
		}

		const user = await prisma.user.update({
			where: {id: userId},
			data: updateData,
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true,
				role: true,
				updatedAt: true,
			},
		});

		res.json({
			message: 'Utilisateur modifié avec succès',
			user,
		});
	} catch (error) {
		console.error("Erreur lors de la modification de l'utilisateur:", error);
		res.status(500).json({error: "Erreur lors de la modification de l'utilisateur"});
	}
};

// Supprimer son propre compte ou un autre compte (admin)
// À faire : vérifier 403 (admin ou soi-même). Si on supprime un admin, vérifier qu'il ne reste pas qu'un seul admin (sinon 400).
// Puis prisma.user.delete par id, et res.json avec un message de succès. try/catch.
export const deleteUser = async (req, res) => {
	try {
		const {id} = req.params;
		const userId = Number(id);

		if (!Number.isInteger(userId)) {
			return res.status(400).json({error: 'ID invalide'});
		}

		const requestedId = Number(req.userId);

		// admin ou soi même
		if (req.userRole !== 'admin' && requestedId !== userId) {
			return res.status(400).json({error: 'Accès refusé'});
		}

		// Empêcher la suppression du dernier admin
		const userToDelete = await prisma.user.findUnique({
			where: {id: userId},
		});

		if (!userToDelete) {
			return res.status(404).json({error: 'Utilisateur non trouvé'});
		}

		if (userToDelete.role === 'admin') {
			const adminCount = await prisma.user.count({
				where: {role: 'admin'},
			});
			if (adminCount === 1) {
				return res.status(400).json({error: 'Impossible de supprimer le dernier administrateur'});
			}
		}

		const deleteUser = await prisma.user.delete({
			where: {id: userId},
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true,
				role: true,
			},
		});

		return res.json({
			message: 'Votre compte à bien été supprimé',
			user: deleteUser,
		});
	} catch (error) {
		console.error("Erreur lors de la suppression de l'utilisateur:", error);
		res.status(500).json({error: "Erreur lors de la suppression de l'utilisateur"});
	}
};
// Liste "light" : uniquement id + email pour tous les utilisateurs.
// À faire : findMany avec un select limité à id et email, puis renvoyer le résultat au client. Gérer les erreurs (try/catch, 500).
export const getAllUsersLight = async (req, res) => {
	try {
		// TODO: ton code ici
	} catch (error) {
		// TODO: gérer l'erreur (log + réponse 500)
	}
};
