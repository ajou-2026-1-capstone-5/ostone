import React from 'react';
import { Link } from 'react-router-dom';
import styles from './dashboard-layout.module.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className={styles.wrapper}>
      {/* Background elements inherited from global styles or specified here */}
      <div className={styles.decorativeCircle1}></div>
      <div className={styles.decorativeCircle2}></div>

      {/* Top Navbar */}
      <header className={styles.topbar}>
        <div className={styles.logo}>
          <span className={styles.logoHighlight}>Ostone</span> Workflow
        </div>
        <nav className={styles.navMenu}>
          <Link to="/upload" className={styles.navItem}>Upload Log</Link>
          <Link to="/consultation" className={`${styles.navItem} ${styles.active}`}>Consultation</Link>
          <Link to="#" className={styles.navItem}>Workflows</Link>
          <Link to="#" className={styles.navItem}>Settings</Link>
        </nav>
        <div className={styles.profileArea}>
          <div className={styles.avatar}>A</div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
};
