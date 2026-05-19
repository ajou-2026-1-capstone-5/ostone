import { PlusIcon } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { useListAllWorkspaceWorkflows } from "@/entities/workflow";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { Button } from "@/shared/ui/button";
import { Pill, Mono } from "@/shared/ui/ostone/atoms";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { EmptyState } from "@/shared/ui/ostone/atoms/EmptyState";

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

  const handleCardClick = (packId: number, versionId: number, workflowId: number) => {
    navigate(
      `/workspaces/${parsedWorkspaceId}/domain-packs/${packId}/versions/${versionId}/workflows/${workflowId}`,
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
        <div className={styles.workflowGrid}>
          {entries.map((wf) => (
            <article
              key={`${wf.packId}-${wf.workflowId}`}
              className={styles.workflowCard}
              onClick={() => handleCardClick(wf.packId, wf.versionId, wf.workflowId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCardClick(wf.packId, wf.versionId, wf.workflowId);
                }
              }}
              data-testid={`workflow-card-${wf.workflowId}`}
            >
              <div className={styles.workflowCardInner}>
                <div className={styles.workflowCardHeader}>
                  <div className={styles.workflowMeta}>
                    <Pill tone="mute">{wf.packName}</Pill>
                    {wf.workflowCode && <Mono className={styles.workflowCode}>{wf.workflowCode}</Mono>}
                  </div>
                </div>

                <div className={styles.workflowCardContent}>
                  <h2 className={styles.workflowTitle}>{wf.name}</h2>
                  {wf.description && <p className={styles.workflowDescription}>{wf.description}</p>}
                </div>

                <div className={styles.workflowCardFooter}>
                  <Mono className={styles.workflowMetaCount}>
                    pack #{wf.packId} · version #{wf.versionId}
                  </Mono>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
