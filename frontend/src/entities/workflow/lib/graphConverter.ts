import type { Node, Edge } from "@xyflow/react";
import type { GraphNode, GraphEdge, GraphNodeType, WorkflowGraph } from "../model/types";

const VALID_NODE_TYPES = new Set<GraphNodeType>([
  "START",
  "ACTION",
  "DECISION",
  "ANSWER",
  "HANDOFF",
  "TERMINAL",
]);

function toNodeType(raw: string | undefined): GraphNodeType {
  if (raw === undefined || raw.trim() === "") return "ACTION";
  const t = raw.toUpperCase();
  if (VALID_NODE_TYPES.has(t as GraphNodeType)) return t as GraphNodeType;
  console.warn(`[graphConverter] unknown node type: "${raw}" — falling back to ACTION`);
  return "ACTION";
}

const NODE_GAP_X = 200;
const NODE_GAP_Y = 120;
const COLUMNS_FOR_TB = 4;
const ROWS_FOR_LR = 4;

function computePosition(
  index: number,
  direction: WorkflowGraph["direction"],
): { x: number; y: number } {
  if (direction === "TB") {
    const col = index % COLUMNS_FOR_TB;
    const row = Math.floor(index / COLUMNS_FOR_TB);
    return { x: col * NODE_GAP_X, y: row * NODE_GAP_Y };
  }
  const col = Math.floor(index / ROWS_FOR_LR);
  const row = index % ROWS_FOR_LR;
  return { x: col * NODE_GAP_X, y: row * NODE_GAP_Y };
}

export function toFlow(graph: WorkflowGraph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n, i) => ({
    id: n.id,
    type: n.type.toLowerCase(),
    data: n.type === "ACTION"
      ? { label: n.label, policyRef: n.policyRef }
      : { label: n.label },
    position: computePosition(i, graph.direction),
  }));

  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.label,
  }));

  return { nodes, edges };
}

export function convertFlowToWorkflowGraph(
  nodes: Node[],
  edges: Edge[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const graphNodes: GraphNode[] = nodes.map((n) => {
    const type = toNodeType(n.type);
    const base = {
      id: n.id,
      type,
      label: typeof n.data?.label === "string" ? n.data.label : "",
    };
    if (type === "ACTION") {
      return {
        ...base,
        policyRef:
          typeof n.data?.policyRef === "string" ? n.data.policyRef || undefined : undefined,
      };
    }
    return base;
  });

  const graphEdges: GraphEdge[] = edges.map((e) => ({
    id: e.id,
    from: e.source,
    to: e.target,
    label: typeof e.label === "string" ? e.label || undefined : undefined,
  }));

  return { nodes: graphNodes, edges: graphEdges };
}
