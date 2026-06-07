import { type ReactNode, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useGetWorkflowDefinition } from "@/entities/workflow";
import type { WorkflowGraph } from "@/entities/workflow";
import { usePackDetail } from "@/features/domain-pack-summary-read";
import { GraphViewer } from "@/features/workflow-viewer/ui/GraphViewer";
import {
  buildDomainPackCrumbs,
  domainPackSectionPath,
} from "@/shared/lib/domainPackRoutes";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import type { Crumb } from "@/shared/ui/ostone/chrome";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/ostone/atoms/EmptyState";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { Icon } from "@/shared/ui/ostone/atoms";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { DomainPackShellState } from "./DomainPackShellState";
import styles from "./WorkflowGraphViewerPage.module.css";

function isWorkflowGraph(value: unknown): value is WorkflowGraph {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const graph = value as {
    nodes?: unknown;
    edges?: unknown;
    direction?: unknown;
  };
  const hasValidDirection =
    graph.direction === undefined ||
    graph.direction === "LR" ||
    graph.direction === "TB";
  return (
    Array.isArray(graph.nodes) &&
    Array.isArray(graph.edges) &&
    hasValidDirection
  );
}

type GraphParseResult =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "ready"; graph: WorkflowGraph };

function parseWorkflowGraph(rawGraph: unknown): GraphParseResult {
  if (rawGraph === undefined || rawGraph === null || rawGraph === "") {
    return { status: "empty" };
  }

  if (typeof rawGraph === "string") {
    try {
      const parsed: unknown = JSON.parse(rawGraph);
      return isWorkflowGraph(parsed)
        ? { status: "ready", graph: parsed }
        : { status: "invalid" };
    } catch {
      return { status: "invalid" };
    }
  }

  return isWorkflowGraph(rawGraph)
    ? { status: "ready", graph: rawGraph }
    : { status: "invalid" };
}

export function WorkflowGraphViewerPage() {
  const { workspaceId, packId, workflowId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const wsId = parseRouteId(workspaceId);
  const pkId = parseRouteId(packId);
  const vsId = parseRouteId(search.get("versionId") ?? undefined);
  const wfId = parseRouteId(workflowId);

  const enabled =
    wsId !== null && pkId !== null && vsId !== null && wfId !== null;

  const { data, isLoading, error } = useGetWorkflowDefinition({
    workspaceId: wsId ?? 0,
    packId: pkId ?? 0,
    versionId: vsId ?? 0,
    workflowId: wfId ?? 0,
    enabled,
  });

  const packDetail = usePackDetail(wsId ?? 0, pkId ?? 0, {
    enabled: enabled,
  }).data;
  const packName = packDetail?.name ?? `PACK · ${pkId ?? "?"}`;
  const versionNo =
    packDetail?.versions?.find((v) => v.versionId === vsId)?.versionNo ??
    vsId ??
    0;

  const graphResult = useMemo(
    () => parseWorkflowGraph(data?.graphJson),
    [data?.graphJson],
  );

  useEffect(() => {
    if (error) {
      toast.error("워크플로우 데이터를 불러오지 못했습니다.");
    }
  }, [error]);

  const crumbs = useMemo<Crumb[]>(() => {
    if (wsId === null || pkId === null || vsId === null) {
      return ["도메인팩 관리", "워크플로우 그래프"];
    }

    return buildDomainPackCrumbs({
      wsId,
      pId: pkId,
      vId: vsId,
      packName,
      versionNo,
      section: { label: "워크플로우", path: "workflows" },
      selectedLabel:
        data?.workflowCode ?? (wfId !== null ? `#${wfId} 흐름도` : "흐름도"),
    });
  }, [data?.workflowCode, packName, pkId, versionNo, vsId, wfId, wsId]);

  const listPath =
    wsId !== null && pkId !== null
      ? domainPackSectionPath(wsId, pkId, vsId, "workflows")
      : "/workspaces";
  const detailPath =
    wsId !== null && pkId !== null && vsId !== null && wfId !== null
      ? domainPackSectionPath(wsId, pkId, vsId, "workflows", wfId)
      : null;

  const pageTitle =
    data?.name ??
    data?.workflowCode ??
    (wfId !== null ? `워크플로우 #${wfId}` : "워크플로우 그래프");

  const shell = (children: ReactNode) => (
    <DomainPackShellState crumbs={crumbs}>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.titleStack}>
            <h2 className={styles.title}>{pageTitle}</h2>
            {data?.description && (
              <p className={styles.description}>{data.description}</p>
            )}
          </div>
          <div className={styles.actions}>
            <Button
              type="button"
              variant="outline"
              className={`${styles.headerButton} ${styles.backAction}`}
              onClick={() => navigate(listPath)}
            >
              <Icon name="chevron" size={14} />
              목록
            </Button>
            {detailPath && (
              <Button
                type="button"
                className={`${styles.headerButton} ${styles.detailAction}`}
                onClick={() => navigate(detailPath)}
              >
                <Icon name="flow" size={14} />
                상세
              </Button>
            )}
          </div>
        </div>
        <div className={styles.canvasFrame}>{children}</div>
      </div>
    </DomainPackShellState>
  );

  if (!enabled) {
    return shell(
      <div
        role="alert"
        data-testid="url-error-state"
        className={styles.centerState}
      >
        <ErrorState message="잘못된 URL 파라미터입니다." />
      </div>,
    );
  }

  if (isLoading) {
    return shell(
      <div data-testid="loading-state" className={styles.loadingState}>
        <LoadingSpinner />
        <span className={styles.loadingText}>
          워크플로우 데이터를 불러오는 중...
        </span>
      </div>,
    );
  }

  if (error) {
    return shell(
      <div data-testid="error-state" className={styles.centerState}>
        <ErrorState
          message={
            error instanceof Error
              ? error.message
              : "데이터를 불러오는 중 오류가 발생했습니다."
          }
        />
      </div>,
    );
  }

  if (graphResult.status === "invalid") {
    return shell(
      <div data-testid="graph-data-error-state" className={styles.centerState}>
        <ErrorState message="워크플로우 그래프 데이터 형식이 올바르지 않습니다." />
      </div>,
    );
  }

  if (graphResult.status === "empty") {
    return shell(
      <div data-testid="empty-state" className={styles.centerState}>
        <EmptyState message="표시할 워크플로우 그래프가 없습니다." />
      </div>,
    );
  }

  return shell(
    <div className={styles.graphContainer}>
      <GraphViewer graph={graphResult.graph} />
    </div>,
  );
}
