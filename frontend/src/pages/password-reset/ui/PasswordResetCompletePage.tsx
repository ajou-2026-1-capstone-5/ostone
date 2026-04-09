import React from 'react';
import { AuthLayout } from '../../../shared/ui/layout/AuthLayout';
import { PasswordResetCompleteForm } from '../../../features/auth/ui/password-reset-complete-form/PasswordResetCompleteForm';

export const PasswordResetCompletePage: React.FC = () => {
  return (
    <AuthLayout>
      <PasswordResetCompleteForm />
    </AuthLayout>
  );
};
