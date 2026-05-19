import { PlusIcon } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { useListAllWorkspaceWorkflows } from "@/entities/workflow";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { Button } from "@/shared/ui/button";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { EmptyState } from "@/shared/ui/ostone/atoms/EmptyState";
import { WorkflowListView } from "@/features/workflow-list";

import styles from "./workspace-workflows-page.module.css";

export function WorkspaceWorkflowsPage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);

  const { loading, error, entries } = useListAllWorkspaceWorkflows({
    workspaceId: parsedWorkspaceId,
  });

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  const handleOpen = (entry: { packId: number; versionId: number; workflowId: number }) => {
    navigate(
      `/workspaces/${parsedWorkspaceId}/domain-packs/${entry.packId}/versions/${entry.versionId}/workflows/${entry.workflowId}`,
    );
  };

  const handleNewWorkflow = () => {
    toast("준비 중입니다");
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Workflows</h1>
        <Button variant="outline" size="sm" onClick={handleNewWorkflow}>
          <PlusIcon className={styles.pageHeaderIcon} />
          <span>새 워크플로우</span>
        </Button>
      </div>

      {loading && (
        <div className={styles.statePanel} data-testid="workspace-workflows-loading">
          <LoadingSpinner />
          <p className={styles.stateText}>워크플로우 목록을 불러오는 중입니다.</p>
        </div>
      )}

      {!loading && error && (
        <div data-testid="workspace-workflows-error">
          <ErrorState message={error} />
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className={styles.statePanel} data-testid="workspace-workflows-empty">
          <EmptyState message="아직 등록된 워크플로우가 없습니다. 도메인팩에서 워크플로우를 생성해 주세요." />
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <WorkflowListView
          entries={entries}
          onOpen={handleOpen}
          testIdPrefix="workspace-workflows"
        />
      )}
    </div>
  );
}
