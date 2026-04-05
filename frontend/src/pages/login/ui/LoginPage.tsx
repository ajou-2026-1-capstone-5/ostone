import React from 'react';
import { AuthLayout } from '../../../shared/ui/layout/AuthLayout';
import { LoginForm } from '../../../features/auth/ui/login-form/LoginForm';

export const LoginPage: React.FC = () => {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
};
