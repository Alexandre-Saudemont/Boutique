# 🏗️ Architecture du Backend

## Structure des Fichiers

```
backend/
├── controllers/          # Controllers (logique métier)
│   ├── authController.js
│   ├── usersController.js
│   ├── productsController.js
│   └── cartController.js
├── middleware/           # Middleware (authentification, etc.)
│   └── auth.js
├── router.js            # Router central (toutes les routes)
├── server.js            # Point d'entrée du serveur
└── prisma/
    └── schema.prisma
```

## 📋 Router Central (`router.js`)

Le fichier `router.js` répertorie **TOUTES** les routes de l'API :

```javascript
// AUTHENTIFICATION
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticate, authController.getMe);

// UTILISATEURS
router.get('/users', authenticate, isAdmin, usersController.getAllUsers);
router.get('/users/:id', authenticate, usersController.getUserById);
router.put('/users/:id', authenticate, usersController.updateUser);
router.delete('/users/:id', authenticate, usersController.deleteUser);

// PRODUITS
router.get('/products', productsController.getAllProducts);
router.get('/products/:id', productsController.getProductById);
router.post('/products', authenticate, isAdmin, productsController.createProduct);
router.put('/products/:id', authenticate, isAdmin, productsController.updateProduct);
router.delete('/products/:id', authenticate, isAdmin, productsController.deleteProduct);

// PANIER
router.get('/cart', authenticate, cartController.getCart);
router.post('/cart/items', authenticate, cartController.addCartItem);
router.put('/cart/items/:itemId', authenticate, cartController.updateCartItem);
router.delete('/cart/items/:itemId', authenticate, cartController.deleteCartItem);
router.delete('/cart', authenticate, cartController.clearCart);
```

## 🎯 Controllers

Chaque controller contient la logique métier pour une ressource :

- **authController.js** : Inscription, connexion, profil
- **usersController.js** : CRUD utilisateurs
- **productsController.js** : CRUD produits
- **cartController.js** : Gestion du panier

## 🔐 Middleware

- **authenticate** : Vérifie que l'utilisateur est connecté
- **isAdmin** : Vérifie que l'utilisateur est admin

## 📝 Exemple d'utilisation

Pour ajouter une nouvelle route :

1. Créer la fonction dans le controller approprié
2. Ajouter la route dans `router.js`

```javascript
// Dans productsController.js
export const getProductsByCategory = async (req, res) => {
  // Logique métier
};

// Dans router.js
router.get('/products/category/:category', productsController.getProductsByCategory);
```

## ✅ Avantages

- ✅ Toutes les routes au même endroit (`router.js`)
- ✅ Logique métier séparée dans les controllers
- ✅ Facile à maintenir et à comprendre
- ✅ Structure claire et organisée
