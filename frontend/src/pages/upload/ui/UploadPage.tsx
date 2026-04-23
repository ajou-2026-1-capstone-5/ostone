import React from "react";
import { useParams } from "react-router-dom";

import { LogUploadForm } from "../../../features/log-upload/ui/LogUploadForm";
import { DashboardLayout } from "../../../shared/ui/layout/DashboardLayout";
import { parseRouteId } from "../../../shared/lib/parseRouteId";

import styles from "./upload-page.module.css";

export const UploadPage: React.FC = () => {
  const { workspaceId } = useParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);

  if (parsedWorkspaceId !== null) {
    return (
      <div className={styles.uploadWrapper}>
        <LogUploadForm workspaceId={parsedWorkspaceId} />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.uploadWrapper}>
        <LogUploadForm />
      </div>
    </DashboardLayout>
  );
};
