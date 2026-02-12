import {PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();

// Obtenir le panier de l'utilisateur connecté
export const getCart = async (req, res) => {
	try {
		// Trouver ou créer le panier
		let cart = await prisma.cart.findUnique({
			where: {userId: req.userId},
			include: {
				cartItems: {
					include: {
						product: true,
					},
				},
			},
		});

		if (!cart) {
			cart = await prisma.cart.create({
				data: {
					userId: req.userId,
				},
				include: {
					cartItems: {
						include: {
							product: true,
						},
					},
				},
			});
		}

		res.json(cart);
	} catch (error) {
		console.error('Erreur lors de la récupération du panier:', error);
		res.status(500).json({error: 'Erreur lors de la récupération du panier'});
	}
};

// Ajouter un produit au panier
export const addCartItem = async (req, res) => {
	try {
		const {productId, quantity} = req.body;

		if (!productId || !quantity || quantity <= 0) {
			return res.status(400).json({error: 'productId et quantity (positif) sont requis'});
		}

		// Vérifier que le produit existe et est actif
		const product = await prisma.product.findUnique({
			where: {id: parseInt(productId)},
		});

		if (!product) {
			return res.status(404).json({error: 'Produit non trouvé'});
		}

		if (!product.isActive) {
			return res.status(400).json({error: "Ce produit n'est plus disponible"});
		}

		if (product.stock < quantity) {
			return res.status(400).json({error: `Stock insuffisant. Disponible: ${product.stock}`});
		}

		// Trouver ou créer le panier
		let cart = await prisma.cart.findUnique({
			where: {userId: req.userId},
		});

		if (!cart) {
			cart = await prisma.cart.create({
				data: {userId: req.userId},
			});
		}

		// Vérifier si le produit est déjà dans le panier
		const existingCartItem = await prisma.cartItem.findFirst({
			where: {
				cartId: cart.id,
				productId: parseInt(productId),
			},
		});

		let cartItem;

		if (existingCartItem) {
			// Mettre à jour la quantité
			cartItem = await prisma.cartItem.update({
				where: {id: existingCartItem.id},
				data: {
					quantity: existingCartItem.quantity + parseInt(quantity),
				},
				include: {
					product: true,
				},
			});
		} else {
			// Créer un nouvel item
			cartItem = await prisma.cartItem.create({
				data: {
					cartId: cart.id,
					productId: parseInt(productId),
					quantity: parseInt(quantity),
				},
				include: {
					product: true,
				},
			});
		}

		res.status(201).json({
			message: 'Produit ajouté au panier',
			cartItem,
		});
	} catch (error) {
		console.error("Erreur lors de l'ajout au panier:", error);
		res.status(500).json({error: "Erreur lors de l'ajout au panier"});
	}
};

// Modifier la quantité d'un item dans le panier
export const updateCartItem = async (req, res) => {
	try {
		const {itemId} = req.params;
		const {quantity} = req.body;

		if (!quantity || quantity <= 0) {
			return res.status(400).json({error: 'La quantité doit être positive'});
		}

		// Vérifier que l'item appartient au panier de l'utilisateur
		const cart = await prisma.cart.findUnique({
			where: {userId: req.userId},
		});

		if (!cart) {
			return res.status(404).json({error: 'Panier non trouvé'});
		}

		const cartItem = await prisma.cartItem.findFirst({
			where: {
				id: parseInt(itemId),
				cartId: cart.id,
			},
			include: {
				product: true,
			},
		});

		if (!cartItem) {
			return res.status(404).json({error: 'Item non trouvé dans le panier'});
		}

		// Vérifier le stock
		if (cartItem.product.stock < quantity) {
			return res.status(400).json({error: `Stock insuffisant. Disponible: ${cartItem.product.stock}`});
		}

		const updatedItem = await prisma.cartItem.update({
			where: {id: parseInt(itemId)},
			data: {quantity: parseInt(quantity)},
			include: {
				product: true,
			},
		});

		res.json({
			message: 'Quantité mise à jour',
			cartItem: updatedItem,
		});
	} catch (error) {
		console.error('Erreur lors de la mise à jour du panier:', error);
		res.status(500).json({error: 'Erreur lors de la mise à jour du panier'});
	}
};

// Supprimer un produit du panier
export const deleteCartItem = async (req, res) => {
	try {
		const {itemId} = req.params;

		// Vérifier que l'item appartient au panier de l'utilisateur
		const cart = await prisma.cart.findUnique({
			where: {userId: req.userId},
		});

		if (!cart) {
			return res.status(404).json({error: 'Panier non trouvé'});
		}

		const cartItem = await prisma.cartItem.findFirst({
			where: {
				id: parseInt(itemId),
				cartId: cart.id,
			},
		});

		if (!cartItem) {
			return res.status(404).json({error: 'Item non trouvé dans le panier'});
		}

		await prisma.cartItem.delete({
			where: {id: parseInt(itemId)},
		});

		res.json({message: 'Produit retiré du panier'});
	} catch (error) {
		console.error('Erreur lors de la suppression du panier:', error);
		res.status(500).json({error: 'Erreur lors de la suppression du panier'});
	}
};

// Vider le panier
export const clearCart = async (req, res) => {
	try {
		const cart = await prisma.cart.findUnique({
			where: {userId: req.userId},
		});

		if (!cart) {
			return res.status(404).json({error: 'Panier non trouvé'});
		}

		await prisma.cartItem.deleteMany({
			where: {cartId: cart.id},
		});

		res.json({message: 'Panier vidé avec succès'});
	} catch (error) {
		console.error('Erreur lors du vidage du panier:', error);
		res.status(500).json({error: 'Erreur lors du vidage du panier'});
	}
};
