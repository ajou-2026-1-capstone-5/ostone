import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";

import { mapWorkspaceActionError, workspaceApi, type WorkspaceResponse } from "@/entities/workspace";
import { Button } from "@/shared/ui/button";
import { DashboardLayout } from "@/shared/ui/layout/DashboardLayout";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { Spinner } from "@/shared/ui/spinner";
import { WorkspaceShell } from "@/widgets/workspace-shell/ui/WorkspaceShell";

import styles from "./workspace-layout.module.css";

export function WorkspaceLayout() {
  const { workspaceId } = useParams();
  const location = useLocation();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(parsedWorkspaceId !== null);
  const [error, setError] = useState("");

  const loadWorkspace = useCallback(async (resolvedWorkspaceId: number) => {
    setIsLoading(true);
    setError("");

    try {
      const workspaceResult = await workspaceApi.get(resolvedWorkspaceId);
      setWorkspace(workspaceResult);
    } catch (err) {
      setError(mapWorkspaceActionError(err));
      setWorkspace(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (parsedWorkspaceId === null) {
      setWorkspace(null);
      setIsLoading(false);
      setError("");
      return;
    }

    void loadWorkspace(parsedWorkspaceId);
  }, [loadWorkspace, parsedWorkspaceId]);

  if (parsedWorkspaceId === null) {
    return (
      <DashboardLayout>
        <div className={styles.invalidState} role="alert">
          잘못된 워크스페이스 주소입니다.
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className={styles.statePanel} aria-live="polite">
          <Spinner />
          <p className={styles.stateText}>워크스페이스 정보를 불러오는 중입니다.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !workspace) {
    return (
      <DashboardLayout>
        <div className={styles.statePanel} role="alert">
          <p className={styles.stateTitle}>워크스페이스를 불러오지 못했습니다.</p>
          <p className={styles.stateText}>{error || "워크스페이스를 찾을 수 없습니다."}</p>
          <Button variant="outline" onClick={() => void loadWorkspace(parsedWorkspaceId)}>
            다시 시도
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const sectionTitle = location.pathname.endsWith("/upload") ? "Upload" : "Workflows";

  return (
    <DashboardLayout>
      <WorkspaceShell
        workspaceId={parsedWorkspaceId}
        title={sectionTitle}
        workspaceName={workspace.name}
      >
        <Outlet context={{ workspace }} />
      </WorkspaceShell>
    </DashboardLayout>
  );
}
