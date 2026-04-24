import React from "react";

import { LogUploadForm } from "../../../features/log-upload/ui/LogUploadForm";
import { DashboardLayout } from "../../../shared/ui/layout/DashboardLayout";

import styles from "./upload-page.module.css";

export const UploadPage: React.FC = () => {
  return (
    <DashboardLayout>
      <div className={styles.uploadWrapper}>
        <LogUploadForm />
      </div>
    </DashboardLayout>
  );
};
