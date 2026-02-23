import styles from './page.module.css';

export default function BoxMysterePage() {
	return (
		<div className={styles.page}>
			<main className={styles.main}>
				<div className={styles.hero}>
					<h1 className={styles.heroTitle}>Box Mystère</h1>
					<p className={styles.heroSubtitle}>
						Découvrez nos box mystères remplis de surprises et de jeux de société à prix réduits
					</p>
				</div>

				<section className={styles.content}>
					<h2 className={styles.sectionTitle}>NOS BOX MYSTÈRES</h2>
					<div className={styles.productsGrid}>
						{/* Placeholder pour les box mystères */}
						<div className={styles.productCard}>
							<div className={styles.productImage}></div>
							<h3 className={styles.productTitle}>Box Mystère - Petite</h3>
							<p className={styles.productPrice}>19.95 €</p>
						</div>
						<div className={styles.productCard}>
							<div className={styles.productImage}></div>
							<h3 className={styles.productTitle}>Box Mystère - Moyenne</h3>
							<p className={styles.productPrice}>39.95 €</p>
						</div>
						<div className={styles.productCard}>
							<div className={styles.productImage}></div>
							<h3 className={styles.productTitle}>Box Mystère - Grande</h3>
							<p className={styles.productPrice}>59.95 €</p>
						</div>
						<div className={styles.productCard}>
							<div className={styles.productImage}></div>
							<h3 className={styles.productTitle}>Box Mystère - Premium</h3>
							<p className={styles.productPrice}>89.95 €</p>
						</div>
					</div>
				</section>
			</main>
		</div>
	);
}
