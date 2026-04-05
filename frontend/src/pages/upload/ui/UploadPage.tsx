import React from 'react';
import { DashboardLayout } from '../../../shared/ui/layout/DashboardLayout';
import { LogUploadForm } from '../../../features/log-upload/ui/LogUploadForm';

export const UploadPage: React.FC = () => {
  return (
    <DashboardLayout>
      <LogUploadForm />
    </DashboardLayout>
  );
};
