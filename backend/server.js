import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {PrismaClient} from '@prisma/client';

// Import du router central
import router from './router.js';

// Charger les variables d'environnement
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Route de santé
app.get('/api/health', (req, res) => {
	res.json({status: 'OK', message: 'Backend is running'});
});

// Routes API (toutes les routes sont dans router.js)
app.use('/api', router);

// Démarrer le serveur
app.listen(PORT, () => {
	console.log(`🚀 Server running on http://localhost:${PORT}`);
	console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

// Gestion propre de la fermeture
process.on('SIGINT', async () => {
	await prisma.$disconnect();
	process.exit(0);
});
