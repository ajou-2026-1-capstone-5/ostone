import { useParams } from "react-router-dom";

import { useGetWorkflowDefinition } from "@/entities/workflow";

interface WorkflowGraphMiniProps {
  /** When null the workspaceId is pulled from route params. */
  workspaceId: number | null;
  packId: number;
  versionId: number;
  workflowId: number;
}

type NodeType = "START" | "ACTION" | "DECISION" | "ANSWER" | "HANDOFF" | "TERMINAL" | "UNKNOWN";

interface ParsedNode {
  id: string;
  label: string;
  type: NodeType;
  x: number;
  y: number;
}

function pickType(v: unknown): NodeType {
  if (typeof v !== "string") return "UNKNOWN";
  const upper = v.toUpperCase();
  switch (upper) {
    case "START":
    case "ACTION":
    case "DECISION":
    case "ANSWER":
    case "HANDOFF":
    case "TERMINAL":
      return upper;
    default:
      return "UNKNOWN";
  }
}

function NodeShape({ node }: { node: ParsedNode }) {
  const { x, y, type } = node;
  const w = 18;
  const h = 11;
  const stroke = "var(--ink)";
  const paper = "var(--paper)";
  const ink = "var(--ink)";
  const sw = 1.4;
  switch (type) {
    case "START":
      return (
        <rect
          x={x - w / 2}
          y={y - h / 2}
          width={w}
          height={h}
          rx={h / 2}
          ry={h / 2}
          fill={ink}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    case "ACTION":
      return (
        <rect
          x={x - w / 2}
          y={y - h / 2}
          width={w}
          height={h}
          rx={2}
          ry={2}
          fill={paper}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    case "DECISION": {
      const r = 8;
      return (
        <polygon
          points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
          fill={paper}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    }
    case "ANSWER": {
      const cut = 3;
      return (
        <polygon
          points={`${x - w / 2 + cut},${y - h / 2} ${x + w / 2},${y - h / 2} ${x + w / 2},${y + h / 2} ${x - w / 2},${y + h / 2}`}
          fill={paper}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    }
    case "HANDOFF": {
      const cut = 3;
      return (
        <polygon
          points={`${x - w / 2 + cut},${y - h / 2} ${x + w / 2 - cut},${y - h / 2} ${x + w / 2},${y + h / 2} ${x - w / 2},${y + h / 2}`}
          fill={paper}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    }
    case "TERMINAL":
      return <circle cx={x} cy={y} r={7} fill={ink} stroke={stroke} strokeWidth={sw} />;
    default:
      return <circle cx={x} cy={y} r={6} fill={paper} stroke={stroke} strokeWidth={sw} />;
  }
}

interface ParsedEdge {
  from: string;
  to: string;
}

function pickEndpoint(value: unknown): string | null {
  return typeof value === "string" ? value : null;
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
          .filter((n): n is { id: string; type?: unknown; label?: string; position?: { x?: number; y?: number } } => {
            return typeof n === "object" && n !== null && typeof (n as { id?: unknown }).id === "string";
          })
          .map<ParsedNode>((n, idx) => ({
            id: n.id,
            label: typeof n.label === "string" && n.label.length > 0 ? n.label : n.id,
            type: pickType(n.type),
            x: typeof n.position?.x === "number" ? n.position.x : idx * 60,
            y: typeof n.position?.y === "number" ? n.position.y : 0,
          }))
      : [];
    const edges = Array.isArray(root.edges)
      ? root.edges
          .map<ParsedEdge | null>((e) => {
            if (typeof e !== "object" || e === null) return null;
            const raw = e as { from?: unknown; to?: unknown; source?: unknown; target?: unknown };
            const from = pickEndpoint(raw.from) ?? pickEndpoint(raw.source);
            const to = pickEndpoint(raw.to) ?? pickEndpoint(raw.target);
            if (!from || !to) return null;
            return { from, to };
          })
          .filter((e): e is ParsedEdge => e !== null)
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
  const padX = 40;
  const padY = 36;
  const width = Math.max(1, maxX - minX) + padX * 2;
  const height = Math.max(1, maxY - minY) + padY * 2;
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));

  return (
    <svg
      data-testid={`workflow-graph-mini-${workflowId}`}
      viewBox={`${minX - padX} ${minY - padY} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      {edges.map((edge) => {
        const s = nodeById.get(edge.from);
        const t = nodeById.get(edge.to);
        if (!s || !t) return null;
        return (
          <line
            key={`${edge.from}→${edge.to}`}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            stroke="var(--ink-3)"
            strokeWidth={1.2}
          />
        );
      })}
      {nodes.map((n) => (
        <g key={n.id} data-node-type={n.type}>
          <NodeShape node={n} />
          <text
            x={n.x}
            y={n.y - 14}
            textAnchor="middle"
            fontSize={10}
            fontFamily="var(--mono)"
            fill="var(--ink-2)"
            style={{ pointerEvents: "none" }}
          >
            {n.label.length > 14 ? `${n.label.slice(0, 13)}…` : n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
