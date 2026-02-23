import styles from './page.module.css';

export default function CoupsDeCoeurPage() {
	return (
		<div className={styles.page}>
			<main className={styles.main}>
				<div className={styles.hero}>
					<h1 className={styles.heroTitle}>Coups de Coeur</h1>
					<p className={styles.heroSubtitle}>
						Notre sélection de jeux de société préférés, testés et approuvés par notre équipe
					</p>
				</div>

				<section className={styles.content}>
					<h2 className={styles.sectionTitle}>NOS COUPS DE COEUR</h2>
					<div className={styles.productsGrid}>
						{/* Placeholder pour les coups de coeur */}
						<div className={styles.productCard}>
							<div className={styles.productImage}></div>
							<h3 className={styles.productTitle}>Jeu Coup de Coeur 1</h3>
							<p className={styles.productPrice}>34.95 €</p>
						</div>
						<div className={styles.productCard}>
							<div className={styles.productImage}></div>
							<h3 className={styles.productTitle}>Jeu Coup de Coeur 2</h3>
							<p className={styles.productPrice}>29.95 €</p>
						</div>
						<div className={styles.productCard}>
							<div className={styles.productImage}></div>
							<h3 className={styles.productTitle}>Jeu Coup de Coeur 3</h3>
							<p className={styles.productPrice}>44.95 €</p>
						</div>
						<div className={styles.productCard}>
							<div className={styles.productImage}></div>
							<h3 className={styles.productTitle}>Jeu Coup de Coeur 4</h3>
							<p className={styles.productPrice}>39.95 €</p>
						</div>
					</div>
				</section>
			</main>
		</div>
	);
}
