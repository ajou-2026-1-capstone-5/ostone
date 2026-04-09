import React from 'react';
import styles from './auth-layout.module.css';

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * 인증(로그인, 회원가입) 페이지를 위한 공통 레이아웃 컴포넌트입니다.
 * 브랜드 아이덴티티가 담긴 배경 구조와 중앙 정렬된 폼 컨테이너를 제공합니다.
 * 
 * @param {AuthLayoutProps} props - 자식 컴포넌트(children)
 * @returns {JSX.Element} 인증 레이아웃
 */
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
