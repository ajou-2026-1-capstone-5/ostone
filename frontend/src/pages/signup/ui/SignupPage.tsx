import React from 'react';
import { AuthLayout } from '../../../shared/ui/layout/AuthLayout';
import { SignupForm } from '../../../features/auth/ui/signup-form/SignupForm';

export const SignupPage: React.FC = () => {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  );
};
