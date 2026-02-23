import jwt from 'jsonwebtoken';

// Middleware pour vérifier si l'utilisateur est authentifié
export const authenticate = (req, res, next) => {
	try {
		const token = req.headers.authorization?.split(' ')[1]; // "Bearer TOKEN"

		if (!token) {
			return res.status(401).json({error: 'Token manquant. Authentification requise.'});
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.userId = decoded.userId;
		req.userRole = decoded.role;
		next();
	} catch (error) {
		return res.status(401).json({error: 'Token invalide ou expiré.'});
	}
};

// Middleware pour vérifier si l'utilisateur est admin
export const isAdmin = (req, res, next) => {
	if (req.userRole !== 'admin') {
		return res.status(403).json({error: 'Accès refusé. Droits administrateur requis.'});
	}
	next();
};
