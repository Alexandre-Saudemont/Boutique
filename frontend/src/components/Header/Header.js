'use client';

import {useState, useEffect} from 'react';
import {useRouter} from 'next/navigation';
import LoginModal from '../LoginModal/LoginModal';
import styles from './Header.module.css';

export default function Header() {
	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
	const [user, setUser] = useState(null);
	const router = useRouter();

	useEffect(() => {
		// Vérifier si l'utilisateur est connecté au chargement
		const checkAuth = () => {
			const storedUser = localStorage.getItem('user');
			const storedToken = localStorage.getItem('token');

			if (storedUser && storedToken) {
				try {
					setUser(JSON.parse(storedUser));
				} catch (error) {
					console.error("Erreur lors du parsing de l'utilisateur:", error);
					localStorage.removeItem('user');
					localStorage.removeItem('token');
				}
			}
		};

		checkAuth();
	}, []);

	const handleLoginSuccess = (userData, token) => {
		setUser(userData);
		setIsLoginModalOpen(false);
	};

	const handleLogout = () => {
		localStorage.removeItem('token');
		localStorage.removeItem('user');
		setUser(null);
	};

	const handleAccountClick = () => {
		if (user) {
			// Si connecté, rediriger vers la page profil ou ouvrir menu
			router.push('/profil');
		} else {
			// Si pas connecté, ouvrir la modale
			setIsLoginModalOpen(true);
		}
	};

	return (
		<>
			<header className={styles.header}>
				<div className={styles.topBar}>
					<div className={styles.topBarContent}>
						<div className={styles.actionsContainer}>
							<div className={styles.searchContainer}>
								<input type='text' placeholder='Rechercher...' className={styles.searchInput} />
								<button className={styles.searchButton}>
									<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
										<circle cx='11' cy='11' r='8'></circle>
										<path d='m21 21-4.35-4.35'></path>
									</svg>
								</button>
							</div>

							<div
								className={styles.accountContainer}
								onMouseEnter={() => {
									if (!user) {
										setIsLoginModalOpen(true);
									}
								}}
								onMouseLeave={() => {
									if (!user) {
										setIsLoginModalOpen(false);
									}
								}}>
								<button className={styles.accountButton} onClick={handleAccountClick}>
									<svg width='28' height='28' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
										<path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'></path>
										<circle cx='12' cy='7' r='4'></circle>
									</svg>
									<span>{user ? user.firstName || user.email : 'Mon Compte'}</span>
								</button>

								{!user && isLoginModalOpen && (
									<LoginModal
										isOpen={isLoginModalOpen}
										onClose={() => setIsLoginModalOpen(false)}
										onLoginSuccess={handleLoginSuccess}
									/>
								)}

								{user && (
									<div className={styles.userMenu}>
										<button onClick={() => router.push('/profil')} className={styles.menuItem}>
											Mon Profil
										</button>
										<button onClick={handleLogout} className={styles.menuItem}>
											Déconnexion
										</button>
									</div>
								)}
							</div>

							<button className={styles.cartButton}>
								<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
									<circle cx='9' cy='21' r='1'></circle>
									<circle cx='20' cy='21' r='1'></circle>
									<path d='M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6'></path>
								</svg>
								<span className={styles.cartCount}>0</span>
							</button>
						</div>
					</div>
				</div>
			</header>
		</>
	);
}
