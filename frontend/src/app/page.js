import styles from './page.module.css';

export default function Home() {
	return (
		<div className={styles.page}>
			<main className={styles.main}>
				<div className={styles.hero}>
					<h1 className={styles.heroTitle}>Votre boutique en ligne de Jeux de Société</h1>
					<p className={styles.heroSubtitle}>Découvrez notre sélection de jeux, box mystères et bien plus encore</p>
				</div>

				<section className={styles.content}>
					<h2 className={styles.sectionTitle}>NOS NOUVEAUTÉS</h2>
					<div className={styles.productsGrid}>
						{/* Placeholder pour les produits */}
						<div className={styles.productCard}>
							<div className={styles.productImage}></div>
							<h3 className={styles.productTitle}>Produit exemple</h3>
							<p className={styles.productPrice}>29.95 €</p>
						</div>
						<div className={styles.productCard}>
							<div className={styles.productImage}></div>
							<h3 className={styles.productTitle}>Produit exemple</h3>
							<p className={styles.productPrice}>29.95 €</p>
						</div>
						<div className={styles.productCard}>
							<div className={styles.productImage}></div>
							<h3 className={styles.productTitle}>Produit exemple</h3>
							<p className={styles.productPrice}>29.95 €</p>
						</div>
						<div className={styles.productCard}>
							<div className={styles.productImage}></div>
							<h3 className={styles.productTitle}>Produit exemple</h3>
							<p className={styles.productPrice}>29.95 €</p>
						</div>
					</div>
				</section>
			</main>
		</div>
	);
}
