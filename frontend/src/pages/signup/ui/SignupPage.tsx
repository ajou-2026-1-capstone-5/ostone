import React from 'react';
import { AuthLayout } from '../../../shared/ui/layout/AuthLayout';
import { SignupForm } from '../../../features/auth/ui/signup-form/SignupForm';

/**
 * 새로운 운영자 계정 생성을 위한 회원가입 페이지 컴포넌트입니다.
 * 신규 계정 생성을 위한 입력 폼을 제공합니다.
 * 
 * @returns {JSX.Element} 회원가입 페이지
 */
export const SignupPage: React.FC = () => {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  );
};
