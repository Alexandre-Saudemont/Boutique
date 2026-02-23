# Backend API - Boutique Jeux de Société

API REST pour la boutique de jeux de société.

## 🚀 Installation

1. **Installer les dépendances**

```bash
npm install
```

2. **Configurer PostgreSQL**

Assurez-vous d'avoir PostgreSQL installé et en cours d'exécution.

Créez une base de données :

```sql
CREATE DATABASE boutique_db;
```

3. **Configurer les variables d'environnement**

Copiez le fichier `.env.example` vers `.env` :

```bash
cp .env.example .env
```

Modifiez le fichier `.env` avec vos informations de connexion PostgreSQL :

```
DATABASE_URL="postgresql://username:password@localhost:5432/boutique_db?schema=public"
```

4. **Générer le client Prisma**

```bash
npm run db:generate
```

5. **Exécuter les migrations**

```bash
npm run db:migrate
```

## 🏃 Lancer le serveur

**Mode développement** (avec rechargement automatique) :

```bash
npm run dev
```

**Mode production** :

```bash
npm start
```

Le serveur sera accessible sur `http://localhost:3001`

## 📚 Routes API

### Health Check

-   `GET /api/health` - Vérifier l'état du serveur

### Produits

-   `GET /api/products` - Liste tous les produits
-   `GET /api/products/:id` - Obtenir un produit par ID

## 🗄️ Base de données

### Utiliser Prisma Studio (interface graphique)

```bash
npm run db:studio
```

Accédez à `http://localhost:5555` pour gérer votre base de données visuellement.

## 🔧 Structure du projet

```
backend/
├── prisma/
│   └── schema.prisma      # Schéma de la base de données
├── routes/                 # Routes API (à créer)
├── controllers/            # Contrôleurs (à créer)
├── middleware/             # Middleware (à créer)
├── server.js              # Point d'entrée du serveur
├── .env                   # Variables d'environnement (non commité)
└── package.json
```

## 🔐 Sécurité

-   Ne commitez jamais le fichier `.env`
-   Changez le `JWT_SECRET` en production
-   Utilisez HTTPS en production
