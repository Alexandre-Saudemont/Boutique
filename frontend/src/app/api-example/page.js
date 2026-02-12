'use client';

import { useEffect, useState } from 'react';
import { productService, healthService } from '@/lib/api';
import styles from './page.module.css';

export default function ApiExamplePage() {
  const [products, setProducts] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Vérifier la santé du serveur
        const healthStatus = await healthService.check();
        setHealth(healthStatus);

        // Récupérer les produits
        const productsData = await productService.getAll();
        setProducts(productsData);
      } catch (err) {
        setError(err.message);
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Erreur de connexion</h2>
          <p>{error}</p>
          <p className={styles.hint}>
            Assurez-vous que le serveur backend est démarré sur le port 3001
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1>Test API</h1>
      
      {health && (
        <div className={styles.health}>
          <h2>État du serveur</h2>
          <p>Status: {health.status}</p>
          <p>Message: {health.message}</p>
        </div>
      )}

      <div className={styles.products}>
        <h2>Produits ({products.length})</h2>
        {products.length === 0 ? (
          <p>Aucun produit trouvé. Ajoutez-en via Prisma Studio ou directement dans la base de données.</p>
        ) : (
          <div className={styles.productsGrid}>
            {products.map((product) => (
              <div key={product.id} className={styles.productCard}>
                <h3>{product.name}</h3>
                <p className={styles.price}>{product.price} €</p>
                {product.description && (
                  <p className={styles.description}>{product.description}</p>
                )}
                <p className={styles.stock}>Stock: {product.stock}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
