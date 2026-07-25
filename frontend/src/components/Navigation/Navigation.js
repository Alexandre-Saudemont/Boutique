'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navigation.module.css';

export default function Navigation() {
  const menuItems = [
    { label: 'Accueil', path: '/' },
    { label: 'Coups de coeurs', path: '/coups-de-coeur' },
    { label: 'Box mystère', path: '/box-mystere' },
    { label: 'Boutique', path: '/boutique' },
    { label: 'Ichiban Kuji', path: '/ichiban-kuji' },
    { label: 'Blog', path: '/blog' },
    { label: 'Membre', path: '/membre' }
  ];

  const pathname = usePathname();

  return (
    <nav className={styles.navigation}>
      <div className={styles.navContainer}>
        <ul className={styles.navList}>
          {menuItems.map((item, index) => (
            <li key={index} className={styles.navItem}>
              <Link 
                href={item.path} 
                className={`${styles.navLink} ${pathname === item.path ? styles.active : ''}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
