// Configuration de l'API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/**
 * Fonction utilitaire pour faire des requêtes API
 */
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Services API

export const productService = {
  /**
   * Récupère tous les produits
   */
  getAll: async () => {
    return fetchAPI('/products');
  },

  /**
   * Récupère un produit par son ID
   */
  getById: async (id) => {
    return fetchAPI(`/products/${id}`);
  },
};

export const healthService = {
  /**
   * Vérifie l'état du serveur
   */
  check: async () => {
    return fetchAPI('/health');
  },
};

export default {
  productService,
  healthService,
};
