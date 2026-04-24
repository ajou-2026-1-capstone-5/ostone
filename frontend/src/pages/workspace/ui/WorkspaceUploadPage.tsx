import { Navigate, useParams } from "react-router-dom";

import { LogUploadForm } from "@/features/log-upload/ui/LogUploadForm";
import { parseRouteId } from "@/shared/lib/parseRouteId";

import styles from "../../upload/ui/upload-page.module.css";

export function WorkspaceUploadPage() {
  const { workspaceId } = useParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  return (
    <div className={styles.uploadWrapper}>
      <LogUploadForm workspaceId={parsedWorkspaceId} />
    </div>
  );
}
