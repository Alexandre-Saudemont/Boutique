import Link from 'next/link';
import {Download, FileText, X} from 'lucide-react';
import {lireDroitParJeton} from '@/server/services/digital';
import styles from '../telechargement.module.css';

/* Le lien de téléchargement reçu par e-mail.

   **Cette page ne consomme rien.** Les clients de messagerie et les antivirus
   d'entreprise préchargent les liens qu'ils reçoivent : si l'ouverture de l'URL
   décomptait un téléchargement, un client pourrait perdre ses cinq essais sans
   avoir cliqué une seule fois. C'est le bouton — un formulaire en POST — qui
   consomme, et un préchargement ne fait jamais de POST.

   Le motif d'un refus est dit franchement. Il n'y a rien à cacher ici :
   celui qui présente le lien l'a reçu, et un « ça ne marche pas » sans
   explication ferait écrire au client. */

export const metadata = {
	title: 'Votre téléchargement',
	robots: {index: false, follow: false},
};

function poidsLisible(octets) {
	const mo = octets / (1024 * 1024);
	return mo >= 1 ? `${mo.toFixed(1)} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

const MESSAGES = {
	EXPIRE: {
		titre: 'Ce lien a expiré',
		texte:
			'Les liens envoyés par e-mail sont valables trente jours. Vos fichiers, eux, restent disponibles sans limite depuis votre compte.',
	},
	EPUISE: {
		titre: 'Ce lien a servi cinq fois',
		texte:
			'C’est le maximum pour un lien envoyé par e-mail. Vos fichiers restent disponibles sans limite depuis votre compte.',
	},
	INCONNU: {
		titre: 'Ce lien ne mène à rien',
		texte:
			'Il a peut-être été tronqué en chemin — les e-mails coupent parfois les adresses longues. Retrouvez vos fichiers depuis votre compte, c’est le chemin le plus sûr.',
	},
};

export default async function PageTelechargement({params}) {
	const {jeton} = await params;

	const droit = await lireDroitParJeton(jeton);

	if (!droit?.utilisable) {
		const message = MESSAGES[droit?.motif ?? 'INCONNU'];

		return (
			<section className={styles.page}>
				<div className={styles.bloc}>
					<span className={`${styles.icone} ${styles.iconeEchec}`}>
						<X size={30} strokeWidth={2.75} />
					</span>
					<h1 className={styles.titre}>{message.titre}</h1>
					<p className={styles.texte}>{message.texte}</p>
					<Link href='/compte' className='btn btn-primary' style={{padding: '12px 24px'}}>
						Aller à mon compte
					</Link>
				</div>
			</section>
		);
	}

	return (
		<section className={styles.page}>
			<div className={styles.bloc}>
				<span className={styles.icone}>
					<Download size={30} strokeWidth={2.75} />
				</span>

				<h1 className={styles.titre}>Votre fichier vous attend</h1>
				<p className={styles.texte}>
					Merci pour votre achat. Enregistrez-le tant que le lien est valable — et
					sachez qu’il reste aussi dans votre compte, sans limite de temps.
				</p>

				<div className={styles.fichier}>
					<FileText size={22} strokeWidth={2.75} />
					<span>
						<span className={styles.nomFichier}>{droit.fileName}</span>
						<br />
						<span className={styles.poids}>{poidsLisible(droit.sizeBytes)}</span>
					</span>
				</div>

				{/* Un formulaire, pas un lien : le téléchargement s'écrit en POST pour
				    qu'aucun préchargement automatique ne consomme un essai. */}
				<form method='post' action={`/telechargement/${encodeURIComponent(jeton)}/fichier`}>
					<button type='submit' className='btn btn-primary' style={{padding: '12px 24px'}}>
						Télécharger
					</button>
				</form>

				<p className={styles.restants}>
					{droit.restants === 1
						? 'Dernier téléchargement disponible sur ce lien.'
						: `Encore ${droit.restants} téléchargements sur ce lien.`}
				</p>
			</div>
		</section>
	);
}
