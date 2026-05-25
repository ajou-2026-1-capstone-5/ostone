import { useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useGetWorkflowDefinition } from "@/entities/workflow";
import type { WorkflowGraph } from "@/entities/workflow";
import { usePackDetail } from "@/features/domain-pack-summary-read";
import { GraphViewer } from "@/features/workflow-viewer/ui/GraphViewer";
import { buildDomainPackCrumbs } from "@/shared/lib/domainPackRoutes";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import type { Crumb } from "@/shared/ui/ostone/chrome";
import { OstoneShell } from "@/widgets/ostone-shell";
import styles from "./WorkflowGraphViewerPage.module.css";

export function WorkflowGraphViewerPage() {
  const { workspaceId, packId, workflowId } = useParams();
  const [search] = useSearchParams();

  const wsId = parseRouteId(workspaceId);
  const pkId = parseRouteId(packId);
  const vsId = parseRouteId(search.get("versionId") ?? undefined);
  const wfId = parseRouteId(workflowId);

  const enabled = wsId !== null && pkId !== null && vsId !== null && wfId !== null;

  const { data, isLoading, error } = useGetWorkflowDefinition({
    workspaceId: wsId ?? 0,
    packId: pkId ?? 0,
    versionId: vsId ?? 0,
    workflowId: wfId ?? 0,
    enabled,
  });

  const packDetail = usePackDetail(wsId ?? 0, pkId ?? 0).data;
  const packName = packDetail?.name ?? `PACK · ${pkId ?? "?"}`;
  const versionNo =
    packDetail?.versions?.find((v) => v.versionId === vsId)?.versionNo ?? vsId ?? 0;

  const rawGraph = data?.graphJson;
  const graph = useMemo<WorkflowGraph | null>(() => {
    if (!rawGraph) return null;
    if (typeof rawGraph === "string") {
      try {
        return JSON.parse(rawGraph) as WorkflowGraph;
      } catch {
        console.error("워크플로우 그래프 JSON 파싱 실패:", rawGraph);
        return null;
      }
    }
    return rawGraph as WorkflowGraph;
  }, [rawGraph]);

  useEffect(() => {
    if (error) {
      toast.error("워크플로우 데이터를 불러오지 못했습니다.");
    }
  }, [error]);

  const crumbs: Crumb[] =
    wsId !== null && pkId !== null && vsId !== null
      ? buildDomainPackCrumbs({
          wsId,
          pId: pkId,
          vId: vsId,
          packName,
          versionNo,
          section: { label: "WORKFLOWS", path: "workflows" },
          selectedLabel:
            data?.workflowCode ?? (wfId !== null ? `#${wfId} GRAPH` : "GRAPH"),
        })
      : ["Domain Packs", "Workflow Graph"];

  if (isLoading) {
    return (
      <OstoneShell active="domain" crumbs={crumbs}>
        <div data-testid="loading-state" className={styles.loadingState}>
          워크플로우 데이터를 불러오는 중...
        </div>
      </OstoneShell>
    );
  }

  if (error) {
    return (
      <OstoneShell active="domain" crumbs={crumbs}>
        <div data-testid="error-state" className={styles.errorState}>
          에러:{" "}
          {error instanceof Error ? error.message : "데이터를 불러오는 중 오류가 발생했습니다."}
        </div>
      </OstoneShell>
    );
  }

  if (!graph) {
    return (
      <OstoneShell active="domain" crumbs={crumbs}>
        <div data-testid="empty-state" className={styles.emptyState}>
          표시할 워크플로우 그래프가 없습니다.
        </div>
      </OstoneShell>
    );
  }

  return (
    <OstoneShell active="domain" crumbs={crumbs}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className={styles.graphContainer}>
          <GraphViewer graph={graph} />
        </div>
      </div>
    </OstoneShell>
  );
}
