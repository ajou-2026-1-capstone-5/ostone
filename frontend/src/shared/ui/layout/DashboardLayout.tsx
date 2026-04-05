import React from 'react';
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
          <a href="#" className={`${styles.navItem} ${styles.active}`}>Upload Log</a>
          <a href="#" className={styles.navItem}>Workflows</a>
          <a href="#" className={styles.navItem}>Settings</a>
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
