import express from 'express';
import {PrismaClient} from '@prisma/client';
import {authenticate, isAdmin} from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Obtenir tous les produits (public, mais filtre les produits inactifs pour les non-admins)
router.get('/', async (req, res) => {
	try {
		const isAdminRequest = req.headers.authorization ? true : false; // Simplifié, devrait vérifier le token

		const products = await prisma.product.findMany({
			where: isAdminRequest ? {} : {isActive: true},
			orderBy: {createdAt: 'desc'},
		});
		res.json(products);
	} catch (error) {
		console.error('Erreur lors de la récupération des produits:', error);
		res.status(500).json({error: 'Erreur lors de la récupération des produits'});
	}
});

// Obtenir un produit par ID
router.get('/:id', async (req, res) => {
	try {
		const {id} = req.params;
		const product = await prisma.product.findUnique({
			where: {id: parseInt(id)},
		});

		if (!product) {
			return res.status(404).json({error: 'Produit non trouvé'});
		}

		res.json(product);
	} catch (error) {
		console.error('Erreur lors de la récupération du produit:', error);
		res.status(500).json({error: 'Erreur lors de la récupération du produit'});
	}
});

// Créer un produit (admin seulement)
router.post('/', authenticate, isAdmin, async (req, res) => {
	try {
		const {name, description, price, imageUrl, category, stock} = req.body;

		if (!name || !price) {
			return res.status(400).json({error: 'Le nom et le prix sont obligatoires'});
		}

		const product = await prisma.product.create({
			data: {
				name,
				description: description || null,
				price: parseFloat(price),
				imageUrl: imageUrl || null,
				category: category || null,
				stock: stock ? parseInt(stock) : 0,
				isActive: true,
			},
		});

		res.status(201).json({
			message: 'Produit créé avec succès',
			product,
		});
	} catch (error) {
		console.error('Erreur lors de la création du produit:', error);
		res.status(500).json({error: 'Erreur lors de la création du produit'});
	}
});

// Modifier un produit (admin seulement)
router.put('/:id', authenticate, isAdmin, async (req, res) => {
	try {
		const {id} = req.params;
		const {name, description, price, imageUrl, category, stock, isActive} = req.body;

		const product = await prisma.product.findUnique({
			where: {id: parseInt(id)},
		});

		if (!product) {
			return res.status(404).json({error: 'Produit non trouvé'});
		}

		const updateData = {};
		if (name !== undefined) updateData.name = name;
		if (description !== undefined) updateData.description = description;
		if (price !== undefined) updateData.price = parseFloat(price);
		if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
		if (category !== undefined) updateData.category = category;
		if (stock !== undefined) updateData.stock = parseInt(stock);
		if (isActive !== undefined) updateData.isActive = isActive;

		const updatedProduct = await prisma.product.update({
			where: {id: parseInt(id)},
			data: updateData,
		});

		res.json({
			message: 'Produit modifié avec succès',
			product: updatedProduct,
		});
	} catch (error) {
		console.error('Erreur lors de la modification du produit:', error);
		res.status(500).json({error: 'Erreur lors de la modification du produit'});
	}
});

// Supprimer un produit (admin seulement)
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
	try {
		const {id} = req.params;

		const product = await prisma.product.findUnique({
			where: {id: parseInt(id)},
		});

		if (!product) {
			return res.status(404).json({error: 'Produit non trouvé'});
		}

		await prisma.product.delete({
			where: {id: parseInt(id)},
		});

		res.json({message: 'Produit supprimé avec succès'});
	} catch (error) {
		console.error('Erreur lors de la suppression du produit:', error);
		res.status(500).json({error: 'Erreur lors de la suppression du produit'});
	}
});

export default router;
