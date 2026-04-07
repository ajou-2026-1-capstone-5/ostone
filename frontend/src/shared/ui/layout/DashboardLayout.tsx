import React from 'react';
import { NavLink } from 'react-router-dom';
import styles from './dashboard-layout.module.css';

import { useLogout } from '../../../features/auth/model/useLogout';
import { getAuthUser } from '../../lib/auth';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { logout } = useLogout();
  const user = getAuthUser();
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) => 
    `${styles.navItem} ${isActive ? styles.active : ''}`;

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
          <NavLink to="/upload" className={getNavLinkClass}>Upload Log</NavLink>
          <NavLink to="/consultation" className={getNavLinkClass}>Consultation</NavLink>
          <NavLink to="/workflows" className={getNavLinkClass}>Workflows</NavLink>
          <NavLink to="/settings" className={getNavLinkClass}>Settings</NavLink>
        </nav>
        <div className={styles.profileArea}>
          <div className={styles.avatar}>{userInitial}</div>
          <button className={styles.logoutButton} onClick={logout}>
            로그아웃
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
};
