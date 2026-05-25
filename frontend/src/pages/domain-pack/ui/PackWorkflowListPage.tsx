import { useMemo } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { usePackDetail } from "@/features/domain-pack-summary-read";
import { useListWorkflows } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import { unwrapApiResponse } from "@/shared/api/unwrapApiResponse";
import type { WorkflowDefinitionSummary } from "@/shared/api/generated/zod";
import type { WorkspaceWorkflowEntry } from "@/entities/workflow";
import { buildDomainPackCrumbs, domainPackSectionPath } from "@/shared/lib/domainPackRoutes";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { OstoneShell } from "@/widgets/ostone-shell";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { EmptyState } from "@/shared/ui/ostone/atoms/EmptyState";
import type { Crumb } from "@/shared/ui/ostone/chrome";
import { WorkflowListView } from "@/features/workflow-list";

export function PackWorkflowListPage() {
  const navigate = useNavigate();
  const { workspaceId, packId } = useParams();
  const [search] = useSearchParams();

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(search.get("versionId") ?? undefined);
  const enabled = wsId !== null && pId !== null && vId !== null;

  const packDetail = usePackDetail(wsId ?? 0, pId ?? 0).data;
  const packName = packDetail?.name ?? `PACK · ${pId ?? "?"}`;
  const versionNo =
    packDetail?.versions?.find((v) => v.versionId === vId)?.versionNo ?? vId ?? 0;

  const query = useListWorkflows(wsId ?? 0, pId ?? 0, vId ?? 0, undefined, {
    query: { enabled },
  });

  const entries = useMemo<WorkspaceWorkflowEntry[]>(() => {
    if (!enabled) return [];
    const list = unwrapApiResponse<WorkflowDefinitionSummary[]>(query.data) ?? [];
    return list
      .filter((wf): wf is WorkflowDefinitionSummary & { id: number } => typeof wf.id === "number")
      .map<WorkspaceWorkflowEntry>((wf) => ({
        packId: pId!,
        packName: `pack-${pId}`,
        versionId: vId!,
        workflowId: wf.id,
        workflowCode: wf.workflowCode ?? null,
        name: wf.name || wf.workflowCode || `wf-${wf.id}`,
        description: wf.description ?? null,
        intentDefinitionId: wf.intentDefinitionId ?? null,
      }));
  }, [enabled, query.data, pId, vId]);

  if (!enabled) {
    return <Navigate to="/workspaces" replace />;
  }

  const crumbs: Crumb[] = buildDomainPackCrumbs({
    wsId,
    pId,
    vId,
    packName,
    versionNo,
    section: { label: "WORKFLOWS", path: "workflows" },
  });

  const handleOpen = (entry: WorkspaceWorkflowEntry) => {
    navigate(domainPackSectionPath(wsId, entry.packId, entry.versionId, "workflows", entry.workflowId));
  };

  return (
    <OstoneShell active="workflows" crumbs={crumbs}>
      <div style={{ padding: "24px", height: "100%", overflow: "auto" }}>
        {query.isLoading && (
          <div
            data-testid="pack-workflows-loading"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--s-3)",
              padding: "48px 0",
            }}
          >
            <LoadingSpinner />
            <p style={{ color: "var(--ink)", fontSize: "14px" }}>
              워크플로우 목록을 불러오는 중입니다.
            </p>
          </div>
        )}

        {!query.isLoading && query.isError && (
          <div data-testid="pack-workflows-error">
            <ErrorState message="워크플로우 목록을 불러오지 못했습니다." onRetry={query.refetch} />
          </div>
        )}

        {!query.isLoading && !query.isError && entries.length === 0 && (
          <div data-testid="pack-workflows-empty">
            <EmptyState message="아직 등록된 워크플로우가 없습니다." />
          </div>
        )}

        {!query.isLoading && !query.isError && entries.length > 0 && (
          <WorkflowListView entries={entries} onOpen={handleOpen} testIdPrefix="pack-workflows" />
        )}
      </div>
    </OstoneShell>
  );
}
