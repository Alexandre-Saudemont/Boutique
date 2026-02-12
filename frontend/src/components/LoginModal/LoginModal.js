'use client';

import {useState} from 'react';
import Link from 'next/link';
import styles from './LoginModal.module.css';

export default function LoginModal({isOpen, onClose, onLoginSuccess}) {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setLoading(true);

		try {
			const response = await fetch('http://localhost:3001/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({email, password}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({error: 'Erreur serveur'}));
				throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			// Sauvegarder le token et les infos utilisateur
			localStorage.setItem('token', data.token);
			localStorage.setItem('user', JSON.stringify(data.user));

			// Appeler le callback de succès
			if (onLoginSuccess) {
				onLoginSuccess(data.user, data.token);
			}

			// Fermer la modale
			onClose();
			setEmail('');
			setPassword('');
		} catch (err) {
			// Gestion des erreurs réseau
			if (err.name === 'TypeError' && err.message.includes('fetch')) {
				setError('Impossible de se connecter au serveur. Vérifiez que le backend est lancé sur http://localhost:3001');
			} else {
				setError(err.message || 'Erreur de connexion');
			}
		} finally {
			setLoading(false);
		}
	};

	if (!isOpen) return null;

	return (
		<div className={styles.modal}>
			<h2 className={styles.title}>Connexion</h2>

			<form onSubmit={handleSubmit} className={styles.form}>
				{error && <div className={styles.error}>{error}</div>}

				<div className={styles.formGroup}>
					<label htmlFor="email">Email</label>
					<input
						type="email"
						id="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						placeholder="votre@email.com"
					/>
				</div>

				<div className={styles.formGroup}>
					<label htmlFor="password">Mot de passe</label>
					<input
						type="password"
						id="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						placeholder="••••••••"
					/>
				</div>

				<button type="submit" className={styles.submitButton} disabled={loading}>
					{loading ? 'Connexion...' : 'Se connecter'}
				</button>
			</form>

			<div className={styles.footer}>
				<p>
					Pas encore de compte ?{' '}
					<Link href="/inscription" className={styles.link} onClick={onClose}>
						S'inscrire
					</Link>
				</p>
			</div>
		</div>
	);
}
