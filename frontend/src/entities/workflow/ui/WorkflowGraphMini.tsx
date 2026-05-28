import { useParams } from "react-router-dom";

import { useGetWorkflowDefinition } from "../api/useGetWorkflowDefinition";

import { WorkflowGraphMiniSvg } from "./WorkflowGraphMiniSvg";

interface WorkflowGraphMiniProps {
  workspaceId: number | null;
  packId: number;
  versionId: number;
  workflowId: number;
}

export function WorkflowGraphMini({
  workspaceId,
  packId,
  versionId,
  workflowId,
}: WorkflowGraphMiniProps) {
  const params = useParams();
  const wsIdRaw = workspaceId ?? (params.workspaceId ? Number(params.workspaceId) : NaN);
  const wsId = Number.isFinite(wsIdRaw) ? wsIdRaw : 0;
  const enabled = wsId > 0 && packId > 0 && versionId > 0 && workflowId > 0;

  const query = useGetWorkflowDefinition({
    workspaceId: wsId,
    packId,
    versionId,
    workflowId,
    enabled,
  });

  if (!enabled || query.isLoading) {
    return (
      <span
        data-testid={`workflow-graph-mini-loading-${workflowId}`}
        style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--ink-3)" }}
      >
        loading…
      </span>
    );
  }

  if (query.isError || !query.data) {
    return (
      <span
        data-testid={`workflow-graph-mini-error-${workflowId}`}
        style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--danger)" }}
      >
        graph unavailable
      </span>
    );
  }

  const graphJson = (query.data as { graphJson?: unknown }).graphJson;
  return <WorkflowGraphMiniSvg workflowId={workflowId} graphJson={graphJson} />;
}
