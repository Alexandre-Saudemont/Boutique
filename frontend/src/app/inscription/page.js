'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

export default function InscriptionPage() {
	const router = useRouter();
	const [formData, setFormData] = useState({
		email: '',
		password: '',
		confirmPassword: '',
		firstName: '',
		lastName: '',
	});
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const handleChange = (e) => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		});
		setError('');
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');

		// Validation
		if (formData.password !== formData.confirmPassword) {
			setError('Les mots de passe ne correspondent pas');
			return;
		}

		if (formData.password.length < 6) {
			setError('Le mot de passe doit contenir au moins 6 caractères');
			return;
		}

		setLoading(true);

		try {
			const response = await fetch('http://localhost:3001/api/auth/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					email: formData.email,
					password: formData.password,
					firstName: formData.firstName || null,
					lastName: formData.lastName || null,
				}),
			});

			// Vérifier si la réponse est OK avant de parser le JSON
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({error: 'Erreur serveur'}));
				throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			// Sauvegarder le token et les infos utilisateur
			localStorage.setItem('token', data.token);
			localStorage.setItem('user', JSON.stringify(data.user));

			// Rediriger vers la page d'accueil
			router.push('/');
		} catch (err) {
			// Gestion des erreurs réseau
			if (err.name === 'TypeError' && err.message.includes('fetch')) {
				setError('Impossible de se connecter au serveur. Vérifiez que le backend est lancé sur http://localhost:3001');
			} else {
				setError(err.message || 'Erreur lors de l\'inscription');
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={styles.page}>
			<main className={styles.main}>
				<div className={styles.container}>
					<h1 className={styles.title}>Inscription</h1>
					<p className={styles.subtitle}>Créez votre compte pour commencer</p>

					<form onSubmit={handleSubmit} className={styles.form}>
						{error && <div className={styles.error}>{error}</div>}

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
							<label htmlFor="password">Mot de passe *</label>
							<input
								type="password"
								id="password"
								name="password"
								value={formData.password}
								onChange={handleChange}
								required
								placeholder="••••••••"
								minLength="6"
							/>
						</div>

						<div className={styles.formGroup}>
							<label htmlFor="confirmPassword">Confirmer le mot de passe *</label>
							<input
								type="password"
								id="confirmPassword"
								name="confirmPassword"
								value={formData.confirmPassword}
								onChange={handleChange}
								required
								placeholder="••••••••"
								minLength="6"
							/>
						</div>

						<button type="submit" className={styles.submitButton} disabled={loading}>
							{loading ? 'Inscription...' : 'S\'inscrire'}
						</button>
					</form>

					<div className={styles.footer}>
						<p>
							Déjà un compte ?{' '}
							<Link href="/" className={styles.link}>
								Se connecter
							</Link>
						</p>
					</div>
				</div>
			</main>
		</div>
	);
}
