import React from 'react';
import { AuthLayout } from '../../../shared/ui/layout/AuthLayout';
import { LoginForm } from '../../../features/auth/ui/login-form/LoginForm';

/**
 * 운영자 로그인 화면을 구성하는 페이지 컴포넌트입니다.
 * 배경 이미지와 로그인 폼을 포함한 레이아웃을 제공합니다.
 * 
 * @returns {JSX.Element} 로그인 페이지
 */
export const LoginPage: React.FC = () => {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
};
