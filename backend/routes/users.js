import express from 'express';
import bcrypt from 'bcryptjs';
import {PrismaClient} from '@prisma/client';
import {authenticate, isAdmin} from '../middleware/auth.js';
import {getMe} from '../controllers/usersController.js';
const router = express.Router();
const prisma = new PrismaClient();

// Obtenir tous les utilisateurs (admin seulement)
router.get('/', authenticate, isAdmin, async (req, res) => {
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
});
router.get('/me', authenticate, getMe);

// Obtenir un utilisateur par ID (admin ou soi-même)
router.get('/:id', authenticate, async (req, res) => {
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
});

// Modifier son propre compte ou un autre compte (admin)
router.put('/:id', authenticate, async (req, res) => {
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
});

// Supprimer son propre compte ou un autre compte (admin)
router.delete('/:id', authenticate, async (req, res) => {
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
});

export default router;
