export type GraphNodeType =
  | "START"
  | "ACTION"
  | "DECISION"
  | "ANSWER"
  | "HANDOFF"
  | "TERMINAL"
  | "UNKNOWN";

export interface ParsedNode {
  id: string;
  label: string;
  type: GraphNodeType;
  x: number | null;
  y: number | null;
}

export interface ParsedEdge {
  id: string;
  from: string;
  to: string;
  label: string | null;
}

export interface ParsedGraph {
  nodes: ParsedNode[];
  edges: ParsedEdge[];
}

export function pickNodeType(value: unknown): GraphNodeType {
  if (typeof value !== "string") return "UNKNOWN";
  const upper = value.toUpperCase();
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

function pickEndpoint(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function pickNumeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface RawNode {
  id?: unknown;
  type?: unknown;
  label?: unknown;
  position?: { x?: unknown; y?: unknown };
}

interface RawEdge {
  id?: unknown;
  from?: unknown;
  to?: unknown;
  source?: unknown;
  target?: unknown;
  label?: unknown;
}

function parseNode(raw: unknown): ParsedNode | null {
  if (typeof raw !== "object" || raw === null) return null;
  const node = raw as RawNode;
  if (typeof node.id !== "string" || node.id.length === 0) return null;
  const label = typeof node.label === "string" && node.label.length > 0 ? node.label : node.id;
  return {
    id: node.id,
    label,
    type: pickNodeType(node.type),
    x: pickNumeric(node.position?.x),
    y: pickNumeric(node.position?.y),
  };
}

function parseEdge(raw: unknown, idx: number, seen: Set<string>): ParsedEdge | null {
  if (typeof raw !== "object" || raw === null) return null;
  const edge = raw as RawEdge;
  const from = pickEndpoint(edge.from) ?? pickEndpoint(edge.source);
  const to = pickEndpoint(edge.to) ?? pickEndpoint(edge.target);
  if (!from || !to) return null;
  let id = typeof edge.id === "string" && edge.id.length > 0 ? edge.id : `${from}→${to}`;
  while (seen.has(id)) {
    id = `${id}#${idx}`;
  }
  seen.add(id);
  const label = typeof edge.label === "string" && edge.label.length > 0 ? edge.label : null;
  return { id, from, to, label };
}

export function safeParseGraph(graphJson: unknown): ParsedGraph {
  if (graphJson === undefined || graphJson === null) {
    return { nodes: [], edges: [] };
  }
  let parsed: unknown = graphJson;
  if (typeof graphJson === "string") {
    try {
      parsed = JSON.parse(graphJson);
    } catch {
      return { nodes: [], edges: [] };
    }
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { nodes: [], edges: [] };
  }
  const root = parsed as { nodes?: unknown; edges?: unknown };

  const nodes: ParsedNode[] = Array.isArray(root.nodes)
    ? root.nodes.map(parseNode).filter((n): n is ParsedNode => n !== null)
    : [];

  const seenEdgeIds = new Set<string>();
  const edges: ParsedEdge[] = Array.isArray(root.edges)
    ? root.edges
        .map((raw, idx) => parseEdge(raw, idx, seenEdgeIds))
        .filter((e): e is ParsedEdge => e !== null)
    : [];

  return { nodes, edges };
}
