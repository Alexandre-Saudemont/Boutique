import styles from './AnnouncementBar.module.css';

export default function AnnouncementBar() {
  const announcements = [
    'LIVRAISON OFFERTE dès 35€ d\'achats',
    'Paiement en 3x sans frais dès 70€ d\'achat',
    'Offre de fidélité : cumulez des points pour obtenir des cadeaux'
  ];

  return (
    <div className={styles.announcementBar}>
      <div className={styles.announcementContent}>
        {announcements.map((announcement, index) => (
          <div key={index} className={styles.announcementItem}>
            <span className={styles.announcementText}>{announcement}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
