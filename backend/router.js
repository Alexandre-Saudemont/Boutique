import express from 'express';
import {authenticate, isAdmin} from './middleware/auth.js';

// Import des controllers
import * as authController from './controllers/authController.js';
import * as usersController from './controllers/usersController.js';
import * as productsController from './controllers/productsController.js';
import * as cartController from './controllers/cartController.js';

const router = express.Router();

// ============================================
// ROUTES AUTHENTIFICATION
// ============================================
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticate, authController.getMe);

// ============================================
// ROUTES UTILISATEURS
// ============================================
router.get('/users', authenticate, isAdmin, usersController.getAllUsers);
router.get('/users/:id', authenticate, usersController.getUserById);
router.put('/users/:id', authenticate, usersController.updateUser);
router.delete('/users/:id', authenticate, usersController.deleteUser);

// ============================================
// ROUTES PRODUITS
// ============================================
router.get('/products', productsController.getAllProducts);
router.get('/products/:id', productsController.getProductById);
router.post('/products', authenticate, isAdmin, productsController.createProduct);
router.put('/products/:id', authenticate, isAdmin, productsController.updateProduct);
router.delete('/products/:id', authenticate, isAdmin, productsController.deleteProduct);

// ============================================
// ROUTES PANIER
// ============================================
router.get('/cart', authenticate, cartController.getCart);
router.post('/cart/items', authenticate, cartController.addCartItem);
router.put('/cart/items/:itemId', authenticate, cartController.updateCartItem);
router.delete('/cart/items/:itemId', authenticate, cartController.deleteCartItem);
router.delete('/cart', authenticate, cartController.clearCart);

export default router;
