import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { OstoneShell } from "@/widgets/ostone-shell";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { useGetWorkflowDefinition } from "@/entities/workflow";
import type { WorkflowGraph } from "@/entities/workflow";
import { GraphViewer } from "@/features/workflow-viewer/ui/GraphViewer";
import styles from "./WorkflowGraphViewerPage.module.css";

export function WorkflowGraphViewerPage() {
  const { workspaceId, packId, versionId, workflowId } = useParams();

  const wsId = parseRouteId(workspaceId);
  const pkId = parseRouteId(packId);
  const vsId = parseRouteId(versionId);
  const wfId = parseRouteId(workflowId);

  const enabled = wsId !== null && pkId !== null && vsId !== null && wfId !== null;

  const { data, isLoading, error } = useGetWorkflowDefinition({
    workspaceId: wsId ?? 0,
    packId: pkId ?? 0,
    versionId: vsId ?? 0,
    workflowId: wfId ?? 0,
    enabled,
  });

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

  if (isLoading) {
    return (
      <OstoneShell
        active="domain"
        crumbs={[
          `WS \u00b7 ${wsId ?? "-"}`,
          "Domain Packs",
          `VER \u00b7 ${vsId ?? "-"}`,
          "Workflow Graph",
        ]}
      >
        <div data-testid="loading-state" className={styles.loadingState}>
          워크플로우 데이터를 불러오는 중...
        </div>
      </OstoneShell>
    );
  }

  if (error) {
    toast.error("워크플로우 데이터를 불러오지 못했습니다.");
    return (
      <OstoneShell
        active="domain"
        crumbs={[
          `WS \u00b7 ${wsId ?? "-"}`,
          "Domain Packs",
          `VER \u00b7 ${vsId ?? "-"}`,
          "Workflow Graph",
        ]}
      >
        <div data-testid="error-state" className={styles.errorState}>
          에러: {error instanceof Error ? error.message : "데이터를 불러오는 중 오류가 발생했습니다."}
        </div>
      </OstoneShell>
    );
  }

  if (!graph) {
    return (
      <OstoneShell
        active="domain"
        crumbs={[
          `WS \u00b7 ${wsId ?? "-"}`,
          "Domain Packs",
          `VER \u00b7 ${vsId ?? "-"}`,
          "Workflow Graph",
        ]}
      >
        <div data-testid="empty-state" className={styles.emptyState}>
          표시할 워크플로우 그래프가 없습니다.
        </div>
      </OstoneShell>
    );
  }

  return (
    <OstoneShell
      active="domain"
      crumbs={[
        `WS \u00b7 ${wsId ?? "-"}`,
        "Domain Packs",
        `VER \u00b7 ${vsId ?? "-"}`,
        "Workflow Graph",
      ]}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className={styles.graphContainer}>
          <GraphViewer graph={graph} />
        </div>
      </div>
    </OstoneShell>
  );
}
