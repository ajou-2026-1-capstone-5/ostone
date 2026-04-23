import React from 'react';
import { Navigate } from 'react-router-dom';
import { AuthLayout } from '../../../shared/ui/layout/AuthLayout';
import { LoginForm } from '../../../features/auth/ui/login-form/LoginForm';
import { isAuthenticated } from '../../../shared/lib/auth';

/**
 * 운영자 로그인 화면을 구성하는 페이지 컴포넌트입니다.
 * 배경 이미지와 로그인 폼을 포함한 레이아웃을 제공합니다.
 * 
 * @returns {JSX.Element} 로그인 페이지
 */
export const LoginPage: React.FC = () => {
  if (isAuthenticated()) {
    return <Navigate to="/workspaces" replace />;
  }

  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
};
