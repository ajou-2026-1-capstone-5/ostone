import React from 'react';
import { AuthLayout } from '../../../shared/ui/layout/AuthLayout';
import { PasswordResetInitForm } from '../../../features/auth/ui/password-reset-init-form/PasswordResetInitForm';

export const PasswordResetInitPage: React.FC = () => {
  return (
    <AuthLayout>
      <PasswordResetInitForm />
    </AuthLayout>
  );
};
