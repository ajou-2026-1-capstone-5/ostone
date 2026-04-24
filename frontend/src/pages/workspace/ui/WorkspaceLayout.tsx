import { useEffect, useState } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";

import { mapWorkspaceActionError, workspaceApi, type WorkspaceResponse } from "@/entities/workspace";
import { Button } from "@/shared/ui/button";
import { DashboardLayout } from "@/shared/ui/layout/DashboardLayout";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { Spinner } from "@/shared/ui/spinner";
import { WorkspaceShell } from "@/widgets/workspace-shell/ui/WorkspaceShell";

import styles from "./workspace-layout.module.css";

export function WorkspaceLayout() {
  const { workspaceId } = useParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(parsedWorkspaceId !== null);
  const [error, setError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (parsedWorkspaceId === null) {
      return;
    }

    const controller = new AbortController();

    void workspaceApi
      .get(parsedWorkspaceId, controller.signal)
      .then((workspaceResult) => {
        if (!controller.signal.aborted) {
          setWorkspace(workspaceResult);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        if (!controller.signal.aborted) {
          setError(mapWorkspaceActionError(err));
          setWorkspace(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [parsedWorkspaceId, retryNonce]);

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
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
          <Button
            variant="outline"
            onClick={() => {
              setIsLoading(true);
              setError("");
              setRetryNonce((value) => value + 1);
            }}
          >
            다시 시도
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <WorkspaceShell workspaceId={parsedWorkspaceId} workspaceName={workspace.name}>
        <Outlet context={{ workspace }} />
      </WorkspaceShell>
    </DashboardLayout>
  );
}
