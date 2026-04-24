import React from "react";
import { Navigate, useParams } from "react-router-dom";

import { LogUploadForm } from "../../../features/log-upload/ui/LogUploadForm";
import { DashboardLayout } from "../../../shared/ui/layout/DashboardLayout";
import { parseRouteId } from "../../../shared/lib/parseRouteId";

import styles from "./upload-page.module.css";

export const UploadPage: React.FC = () => {
  const { workspaceId } = useParams();
  const parsedWorkspaceId = workspaceId ? parseRouteId(workspaceId) : null;

  if (workspaceId == null) {
    return (
      <DashboardLayout>
        <div className={styles.uploadWrapper}>
          <LogUploadForm />
        </div>
      </DashboardLayout>
    );
  }

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  return (
    <div className={styles.uploadWrapper}>
      <LogUploadForm workspaceId={parsedWorkspaceId} />
    </div>
  );
};
