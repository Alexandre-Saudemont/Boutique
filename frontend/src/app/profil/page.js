'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function ProfilPage() {
	const router = useRouter();
	const [user, setUser] = useState(null);
	const [formData, setFormData] = useState({
		email: '',
		firstName: '',
		lastName: '',
		password: '',
		confirmPassword: '',
	});
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const token = localStorage.getItem('token');
		const storedUser = localStorage.getItem('user');

		if (!token || !storedUser) {
			router.push('/');
			return;
		}

		const userData = JSON.parse(storedUser);
		setUser(userData);
		setFormData({
			email: userData.email || '',
			firstName: userData.firstName || '',
			lastName: userData.lastName || '',
			password: '',
			confirmPassword: '',
		});

		// Charger les données à jour depuis l'API
		fetchUserData();
	}, [router]);

	const fetchUserData = async () => {
		try {
			const token = localStorage.getItem('token');
			const response = await fetch('http://localhost:3001/api/auth/me', {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const userData = await response.json();
				setUser(userData);
				setFormData({
					email: userData.email || '',
					firstName: userData.firstName || '',
					lastName: userData.lastName || '',
					password: '',
					confirmPassword: '',
				});
			}
		} catch (error) {
			console.error('Erreur lors du chargement du profil:', error);
		}
	};

	const handleChange = (e) => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		});
		setError('');
		setSuccess('');
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setSuccess('');

		if (formData.password && formData.password !== formData.confirmPassword) {
			setError('Les mots de passe ne correspondent pas');
			return;
		}

		setLoading(true);

		try {
			const token = localStorage.getItem('token');
			const updateData = {
				email: formData.email,
				firstName: formData.firstName,
				lastName: formData.lastName,
			};

			if (formData.password) {
				updateData.password = formData.password;
			}

			const response = await fetch(`http://localhost:3001/api/users/${user.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(updateData),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Erreur lors de la modification');
			}

			// Mettre à jour les données locales
			const updatedUser = { ...user, ...data.user };
			localStorage.setItem('user', JSON.stringify(updatedUser));
			setUser(updatedUser);
			setSuccess('Profil mis à jour avec succès');
			setFormData({
				...formData,
				password: '',
				confirmPassword: '',
			});
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	if (!user) {
		return <div className={styles.loading}>Chargement...</div>;
	}

	return (
		<div className={styles.page}>
			<main className={styles.main}>
				<div className={styles.container}>
					<h1 className={styles.title}>Mon Profil</h1>

					<form onSubmit={handleSubmit} className={styles.form}>
						{error && <div className={styles.error}>{error}</div>}
						{success && <div className={styles.success}>{success}</div>}

						<div className={styles.formRow}>
							<div className={styles.formGroup}>
								<label htmlFor="firstName">Prénom</label>
								<input
									type="text"
									id="firstName"
									name="firstName"
									value={formData.firstName}
									onChange={handleChange}
									placeholder="Jean"
								/>
							</div>

							<div className={styles.formGroup}>
								<label htmlFor="lastName">Nom</label>
								<input
									type="text"
									id="lastName"
									name="lastName"
									value={formData.lastName}
									onChange={handleChange}
									placeholder="Dupont"
								/>
							</div>
						</div>

						<div className={styles.formGroup}>
							<label htmlFor="email">Email *</label>
							<input
								type="email"
								id="email"
								name="email"
								value={formData.email}
								onChange={handleChange}
								required
								placeholder="votre@email.com"
							/>
						</div>

						<div className={styles.formGroup}>
							<label htmlFor="password">Nouveau mot de passe (optionnel)</label>
							<input
								type="password"
								id="password"
								name="password"
								value={formData.password}
								onChange={handleChange}
								placeholder="Laisser vide pour ne pas changer"
								minLength="6"
							/>
						</div>

						{formData.password && (
							<div className={styles.formGroup}>
								<label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</label>
								<input
									type="password"
									id="confirmPassword"
									name="confirmPassword"
									value={formData.confirmPassword}
									onChange={handleChange}
									placeholder="••••••••"
									minLength="6"
								/>
							</div>
						)}

						<button type="submit" className={styles.submitButton} disabled={loading}>
							{loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
						</button>
					</form>
				</div>
			</main>
		</div>
	);
}
