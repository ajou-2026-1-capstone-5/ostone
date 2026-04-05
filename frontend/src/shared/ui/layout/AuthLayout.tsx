import React from 'react';
import styles from './auth-layout.module.css';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className={styles.container}>
      <div className={styles.decorativeCircle1}></div>
      <div className={styles.decorativeCircle2}></div>
      <div className={styles.decorativeCircle3}></div>
      <div className={styles.glassCard}>
        {children}
      </div>
    </div>
  );
};
