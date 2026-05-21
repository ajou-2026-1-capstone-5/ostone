import { type ReactNode, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { InlineWorkflowEditor } from "@/features/update-workflow";
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
  const { workspaceId, packId, versionId, workflowId } = useParams();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(versionId);
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
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/workflows`);
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
    <OstoneShell active="workflows" crumbs={crumbs} activePackId={pId} activeWorkflowId={wfId}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid var(--line-2)",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBackToList}
              data-testid="list-back"
              /*
               * shadcn Button defaults to font-medium (500); Pretendard renders
               * that with a noticeably heavy stem. 450 sits between the original
               * thin look and the shadcn default — heavier than regular body
               * copy but lighter than the page title.
               */
              style={{ fontWeight: 450 }}
            >
              <Icon name="chevron" size={14} />
              목록
            </Button>
            <h2
              data-testid="workflow-detail-title"
              style={{
                fontFamily: "var(--sans)",
                fontSize: "16px",
                fontWeight: 600,
                margin: 0,
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {workflow?.name || (query.isLoading ? "워크플로우 로드 중..." : "워크플로우")}
            </h2>
            {workflow?.workflowCode && (
              <Mono style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: 500 }}>
                {workflow.workflowCode}
              </Mono>
            )}
            {workflow && <Pill tone="signal">DRAFT</Pill>}
            {workflow && (
              <Mono style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: 500 }}>
                {nodeCount} nodes
              </Mono>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {workflow && !isEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="edit-toggle"
                onClick={() => setIsEditing(true)}
                style={{ fontWeight: 450 }}
              >
                <Icon name="edit" size={14} />
                편집
              </Button>
            )}
            {workflow && isEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="view-toggle"
                onClick={() => setIsEditing(false)}
                style={{ fontWeight: 450 }}
              >
                <Icon name="eye" size={14} />
                보기
              </Button>
            )}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            position: "relative",
            margin: "12px 20px 20px",
            borderRadius: "var(--r-2)",
            border: "1px solid var(--line-2)",
            background: "var(--paper)",
            overflow: "hidden",
            minHeight: "400px",
          }}
        >
          {!enabled && (
            <div
              data-testid="workflow-select-empty"
              style={{ padding: "32px", textAlign: "center", color: "var(--ink-3)" }}
            >
              좌측 사이드바에서 워크플로우를 선택하세요.
            </div>
          )}

          {enabled && query.isLoading && (
            <div
              data-testid="workflow-loading"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <LoadingSpinner />
              <Mono style={{ fontSize: "11px", color: "var(--ink-3)" }}>워크플로우 로드 중...</Mono>
            </div>
          )}

          {enabled && query.isError && (
            <div data-testid="workflow-error" style={{ padding: "32px" }}>
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
