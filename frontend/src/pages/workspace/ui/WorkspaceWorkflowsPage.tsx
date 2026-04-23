import { useEffect, useState } from "react";
import { RefreshCcwIcon, WorkflowIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { mapWorkspaceActionError, workspaceApi, type WorkspaceResponse } from "@/entities/workspace";
import { DashboardLayout } from "@/shared/ui/layout/DashboardLayout";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { Button } from "@/shared/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { Spinner } from "@/shared/ui/spinner";
import { WorkspaceShell } from "@/widgets/workspace-shell/ui/WorkspaceShell";

import styles from "./workspace-workflows-page.module.css";

export function WorkspaceWorkflowsPage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);

  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchWorkspaceData = async (resolvedWorkspaceId: number) => {
    setIsLoading(true);
    setError("");

    try {
      const workspaceResult = await workspaceApi.get(resolvedWorkspaceId);
      setWorkspace(workspaceResult);
    } catch (err) {
      setError(mapWorkspaceActionError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (parsedWorkspaceId !== null) {
      void fetchWorkspaceData(parsedWorkspaceId);
    }
  }, [parsedWorkspaceId]);

  if (parsedWorkspaceId === null) {
    return (
      <DashboardLayout>
        <div className={styles.invalidState} role="alert">
          잘못된 워크스페이스 주소입니다.
        </div>
      </DashboardLayout>
    );
  }

  const shellTitle = "Workflows";

  return (
    <DashboardLayout>
      <WorkspaceShell
        workspaceId={parsedWorkspaceId}
        title={shellTitle}
        workspaceName={workspace?.name}
      >
        {isLoading ? (
          <div className={styles.statePanel} aria-live="polite">
            <Spinner className={styles.stateSpinner} />
            <p>워크스페이스 정보를 불러오는 중입니다.</p>
          </div>
        ) : error ? (
          <div className={styles.statePanel} role="alert">
            <p className={styles.stateTitle}>워크플로우 목록을 불러오지 못했습니다.</p>
            <p className={styles.stateText}>{error}</p>
            <Button variant="outline" onClick={() => void fetchWorkspaceData(parsedWorkspaceId)}>
              <RefreshCcwIcon className="size-4" />
              다시 시도
            </Button>
          </div>
        ) : (
          <Empty className={styles.emptyState}>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <WorkflowIcon />
              </EmptyMedia>
              <EmptyTitle>대표 workflow version을 확인할 수 없습니다</EmptyTitle>
              <EmptyDescription>
                현재 backend API에는 workspace의 published domain pack version 목록을 조회하는 기존
                endpoint가 없어, publishedAt 기준 최신 대표 version을 해소할 수 없습니다.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => navigate(`/workspaces/${parsedWorkspaceId}/upload`)}>
                Upload로 이동
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </WorkspaceShell>
    </DashboardLayout>
  );
}
