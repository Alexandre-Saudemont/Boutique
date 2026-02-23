import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();

// Inscription
export const register = async (req, res) => {
	try {
		const {email, password, firstName, lastName} = req.body;

		// Validation des champs obligatoires
		if (!email || !password) {
			return res.status(400).json({error: 'L\'email et le mot de passe sont obligatoires.'});
		}

		// Validation de l'email
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return res.status(400).json({error: 'Format d\'email invalide.'});
		}

		// Validation du mot de passe
		if (password.length < 6) {
			return res.status(400).json({error: 'Le mot de passe doit contenir au moins 6 caractères.'});
		}

		// Vérifier si l'email existe déjà
		const existingUser = await prisma.user.findUnique({
			where: {email},
		});

		if (existingUser) {
			return res.status(400).json({error: 'Cet email est déjà utilisé.'});
		}

		// Hasher le mot de passe
		const hashedPassword = await bcrypt.hash(password, 10);

		// Créer l'utilisateur
		const user = await prisma.user.create({
			data: {
				email,
				password: hashedPassword,
				firstName: firstName || null,
				lastName: lastName || null,
				role: 'customer',
			},
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true,
				role: true,
				createdAt: true,
			},
		});

		// Créer le panier pour l'utilisateur
		await prisma.cart.create({
			data: {
				userId: user.id,
			},
		});

		// Générer le token JWT
		const token = jwt.sign({userId: user.id, role: user.role}, process.env.JWT_SECRET, {expiresIn: '7d'});

		res.status(201).json({
			message: 'Utilisateur créé avec succès',
			user,
			token,
		});
	} catch (error) {
		console.error("Erreur lors de l'inscription:", error);
		res.status(500).json({error: "Erreur lors de l'inscription"});
	}
};

// Connexion
export const login = async (req, res) => {
	try {
		const {email, password} = req.body;

		// Trouver l'utilisateur
		const user = await prisma.user.findUnique({
			where: {email},
		});

		if (!user) {
			return res.status(401).json({error: 'Email ou mot de passe incorrect.'});
		}

		// Vérifier le mot de passe
		const isValidPassword = await bcrypt.compare(password, user.password);

		if (!isValidPassword) {
			return res.status(401).json({error: 'Email ou mot de passe incorrect.'});
		}

		// Générer le token JWT
		const token = jwt.sign({userId: user.id, role: user.role}, process.env.JWT_SECRET, {expiresIn: '7d'});

		res.json({
			message: 'Connexion réussie',
			user: {
				id: user.id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
				role: user.role,
			},
			token,
		});
	} catch (error) {
		console.error('Erreur lors de la connexion:', error);
		res.status(500).json({error: 'Erreur lors de la connexion'});
	}
};

// Obtenir le profil de l'utilisateur connecté
export const getMe = async (req, res) => {
	try {
		const user = await prisma.user.findUnique({
			where: {id: req.userId},
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
		console.error('Erreur lors de la récupération du profil:', error);
		res.status(500).json({error: 'Erreur lors de la récupération du profil'});
	}
};
