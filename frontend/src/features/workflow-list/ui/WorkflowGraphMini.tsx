import { useParams } from "react-router-dom";

import { useGetWorkflowDefinition } from "@/entities/workflow";

interface WorkflowGraphMiniProps {
  /** When null the workspaceId is pulled from route params. */
  workspaceId: number | null;
  packId: number;
  versionId: number;
  workflowId: number;
}

interface ParsedNode {
  id: string;
  x: number;
  y: number;
}

interface ParsedEdge {
  source: string;
  target: string;
}

function safeParseGraph(graphJson: unknown): {
  nodes: ParsedNode[];
  edges: ParsedEdge[];
} {
  if (graphJson === undefined || graphJson === null) return { nodes: [], edges: [] };
  let parsed: unknown = graphJson;
  if (typeof graphJson === "string") {
    try {
      parsed = JSON.parse(graphJson);
    } catch {
      return { nodes: [], edges: [] };
    }
  }
  try {
    if (typeof parsed !== "object" || parsed === null) return { nodes: [], edges: [] };
    const root = parsed as { nodes?: unknown; edges?: unknown };
    const nodes = Array.isArray(root.nodes)
      ? root.nodes
          .filter((n): n is { id: string; position?: { x?: number; y?: number } } => {
            return typeof n === "object" && n !== null && typeof (n as { id?: unknown }).id === "string";
          })
          .map<ParsedNode>((n, idx) => ({
            id: n.id,
            x: typeof n.position?.x === "number" ? n.position.x : idx * 60,
            y: typeof n.position?.y === "number" ? n.position.y : 0,
          }))
      : [];
    const edges = Array.isArray(root.edges)
      ? root.edges
          .filter(
            (e): e is { source: string; target: string } =>
              typeof e === "object" &&
              e !== null &&
              typeof (e as { source?: unknown }).source === "string" &&
              typeof (e as { target?: unknown }).target === "string",
          )
          .map<ParsedEdge>((e) => ({ source: e.source, target: e.target }))
      : [];
    return { nodes, edges };
  } catch {
    return { nodes: [], edges: [] };
  }
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

  const { nodes, edges } = safeParseGraph((query.data as { graphJson?: unknown }).graphJson);
  if (nodes.length === 0) {
    return (
      <span
        data-testid={`workflow-graph-mini-empty-${workflowId}`}
        style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--ink-3)" }}
      >
        empty graph
      </span>
    );
  }

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 30;
  const width = Math.max(1, maxX - minX) + pad * 2;
  const height = Math.max(1, maxY - minY) + pad * 2;
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));

  return (
    <svg
      data-testid={`workflow-graph-mini-${workflowId}`}
      viewBox={`${minX - pad} ${minY - pad} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      {edges.map((edge, idx) => {
        const s = nodeById.get(edge.source);
        const t = nodeById.get(edge.target);
        if (!s || !t) return null;
        return (
          <line
            key={`e${idx}`}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            stroke="var(--line)"
            strokeWidth={1.5}
          />
        );
      })}
      {nodes.map((n) => (
        <circle key={n.id} cx={n.x} cy={n.y} r={8} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.5} />
      ))}
    </svg>
  );
}
