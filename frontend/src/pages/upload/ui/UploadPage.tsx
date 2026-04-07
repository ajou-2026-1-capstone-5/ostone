import React from 'react';
import { DashboardLayout } from '../../../shared/ui/layout/DashboardLayout';
import { LogUploadForm } from '../../../features/log-upload/ui/LogUploadForm';

import styles from './upload-page.module.css';

export const UploadPage: React.FC = () => {
  return (
    <DashboardLayout>
      <div className={styles.uploadWrapper}>
        <LogUploadForm />
      </div>
    </DashboardLayout>
  );
};
