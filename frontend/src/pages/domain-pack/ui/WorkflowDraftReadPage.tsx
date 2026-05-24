import { type ReactNode, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { InlineWorkflowEditor } from "@/features/update-workflow";
import { domainPackSectionPath } from "@/shared/lib/domainPackRoutes";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { OstoneShell } from "@/widgets/ostone-shell";
import { Pill, Mono, Icon } from "@/shared/ui/ostone/atoms";
import { Button } from "@/shared/ui/button";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { EmptyState } from "@/shared/ui/ostone/atoms/EmptyState";
import { useGetWorkflowDefinition } from "@/entities/workflow";
import type { WorkflowGraph } from "@/entities/workflow";
import { GraphViewer } from "@/features/workflow-viewer/ui/GraphViewer";
import styles from "./workflow-draft-read-page.module.css";

function isWorkflowGraph(v: unknown): v is WorkflowGraph {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as { nodes?: unknown }).nodes) &&
    Array.isArray((v as { edges?: unknown }).edges)
  );
}

function parseGraphJson(raw: unknown): WorkflowGraph | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return isWorkflowGraph(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isWorkflowGraph(raw) ? raw : null;
}

export function WorkflowDraftReadPage() {
  const { workspaceId, packId, workflowId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(search.get("versionId") ?? undefined);
  const wfId = workflowId ? parseRouteId(workflowId) : null;

  const enabled = wsId !== null && pId !== null && vId !== null && wfId !== null;

  const query = useGetWorkflowDefinition({
    workspaceId: wsId ?? 0,
    packId: pId ?? 0,
    versionId: vId ?? 0,
    workflowId: wfId ?? 0,
    enabled,
  });

  const workflow = query.data;
  const graph = useMemo<WorkflowGraph | null>(
    () => parseGraphJson(workflow?.graphJson),
    [workflow?.graphJson],
  );
  const nodeCount = graph?.nodes?.length ?? 0;

  if (
    wsId === null ||
    pId === null ||
    vId === null ||
    (workflowId !== undefined && wfId === null)
  ) {
    return (
      <OstoneShell active="domain" crumbs={["Domain Packs"]}>
        <div role="alert" style={{ padding: "24px", color: "var(--danger)" }}>
          잘못된 URL 파라미터입니다.
        </div>
      </OstoneShell>
    );
  }

  const handleBackToList = () => {
    setIsEditing(false);
    navigate(domainPackSectionPath(wsId, pId, vId, "workflows"), { replace: true });
  };

  const crumbs = [`WS · ${wsId}`, "Domain Packs", `PACK · ${pId}`, `VER · ${vId}`, "Workflows"];

  let graphContent: ReactNode;
  if (isEditing) {
    graphContent = (
      <InlineWorkflowEditor
        workflow={workflow!}
        wsId={wsId!}
        packId={pId!}
        versionId={vId!}
        onClose={() => setIsEditing(false)}
      />
    );
  } else if (graph) {
    graphContent = (
      <div data-testid="workflow-graph-viewer" style={{ width: "100%", height: "100%" }}>
        <GraphViewer graph={graph} />
      </div>
    );
  } else {
    graphContent = (
      <div data-testid="workflow-empty-graph" style={{ padding: "32px" }}>
        <EmptyState message="이 워크플로우에는 아직 그래프가 정의되어 있지 않습니다." />
      </div>
    );
  }

  return (
    <OstoneShell active="workflows" crumbs={crumbs}>
      <div className={styles.detailPage}>
        <div className={styles.detailHeader}>
          <div className={styles.titleGroup}>
            <div className={styles.titleStack}>
              <h2 data-testid="workflow-detail-title" className={styles.detailTitle}>
                {workflow?.name || (query.isLoading ? "워크플로우 로드 중..." : "워크플로우")}
              </h2>
              {workflow?.description && (
                <p className={styles.detailDescription}>{workflow.description}</p>
              )}
            </div>
            {workflow?.workflowCode && (
              <Mono className={styles.workflowCode}>{workflow.workflowCode}</Mono>
            )}
            {workflow && <Pill tone="signal">DRAFT</Pill>}
            {workflow && isEditing && <Pill tone="ink">EDITING</Pill>}
            {workflow && (
              <Mono className={styles.nodeCount}>{nodeCount} nodes</Mono>
            )}
          </div>

          <div className={styles.headerActions}>
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleBackToList}
              data-testid="list-back"
              className={`${styles.headerButton} ${styles.backAction}`}
            >
              <Icon name="chevron" size={14} />
              목록
            </Button>
            {workflow && !isEditing && (
              <Button
                type="button"
                size="default"
                data-testid="edit-toggle"
                onClick={() => setIsEditing(true)}
                className={`${styles.headerButton} ${styles.editAction}`}
              >
                <Icon name="edit" size={14} />
                편집
              </Button>
            )}
          </div>
        </div>

        <div className={styles.canvasFrame} data-editing={isEditing ? "true" : "false"}>
          {!enabled && (
            <div data-testid="workflow-select-empty" className={styles.centerState}>
              좌측 사이드바에서 워크플로우를 선택하세요.
            </div>
          )}

          {enabled && query.isLoading && (
            <div data-testid="workflow-loading" className={styles.loadingState}>
              <LoadingSpinner />
              <Mono className={styles.loadingText}>워크플로우 로드 중...</Mono>
            </div>
          )}

          {enabled && query.isError && (
            <div data-testid="workflow-error" className={styles.errorState}>
              <ErrorState
                message="워크플로우를 불러오지 못했습니다."
                onRetry={() => query.refetch()}
              />
            </div>
          )}

          {enabled && !query.isLoading && !query.isError && workflow && graphContent}
        </div>
      </div>
    </OstoneShell>
  );
}
