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
export const getUserById = async (req, res) => {
	try {
		const {id} = req.params;
		const userId = parseInt(id);

		// Vérifier que l'utilisateur peut accéder à ce profil
		if (req.userRole !== 'admin' && req.userId !== userId) {
			return res.status(403).json({error: 'Accès refusé'});
		}

		const user = await prisma.user.findUnique({
			where: {id: userId},
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true,
				role: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		if (!user) {
			return res.status(404).json({error: 'Utilisateur non trouvé'});
		}

		res.json(user);
	} catch (error) {
		console.error("Erreur lors de la récupération de l'utilisateur:", error);
		res.status(500).json({error: "Erreur lors de la récupération de l'utilisateur"});
	}
};

export const getMe = async (req, res) => {
	try {
		const userId = req.userId;

		const user = await prisma.user.findUnique({
			where: {id: userId},
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true,
				role: true,
			},
		});

		if (!user) {
			return res.status(404).json({error: 'Utilisateur avec cet ID non trouvé'});
		}

		res.json(user);
	} catch (error) {
		console.error("Impossible de récupérer l'utilisateur avec cet ID", error);
		res.status(500).json({error: "L'utilisateur demandé n'existe pas"});
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
export const deleteUser = async (req, res) => {
	try {
		const {id} = req.params;
		const userId = parseInt(id);

		// Vérifier que l'utilisateur peut supprimer ce compte
		if (req.userRole !== 'admin' && req.userId !== userId) {
			return res.status(403).json({error: 'Accès refusé'});
		}

		// Empêcher la suppression du dernier admin
		if (req.userRole === 'admin') {
			const user = await prisma.user.findUnique({
				where: {id: userId},
			});
			if (user && user.role === 'admin') {
				const adminCount = await prisma.user.count({
					where: {role: 'admin'},
				});
				if (adminCount === 1) {
					return res.status(400).json({error: 'Impossible de supprimer le dernier administrateur'});
				}
			}
		}

		await prisma.user.delete({
			where: {id: userId},
		});

		res.json({message: 'Utilisateur supprimé avec succès'});
	} catch (error) {
		console.error("Erreur lors de la suppression de l'utilisateur:", error);
		res.status(500).json({error: "Erreur lors de la suppression de l'utilisateur"});
	}
};
export const getAllUsersLight = async (req, res) => {
	try {
		const users = await prisma.user.findMany({
			select: {
				id: true,
				email: true,
			},
		});
	} catch (error) {
		return res.status(500).json({error: 'Erreur lors de la récupération des utilisateurs'});
	}
};
