import { type Node, type Edge } from "@xyflow/react";
import type {
  GraphNode,
  GraphEdge,
  GraphNodeType,
  HandleSide,
  WorkflowGraph,
} from "../model/types";
import { SIDE_TO_POSITION } from "./handleUtils";

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

const NODE_GAP_X = 320;
const NODE_GAP_Y = 200;
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

function buildNodeData(n: GraphNode): Record<string, unknown> {
  const data: Record<string, unknown> =
    n.type === "ACTION" ? { label: n.label, policyRef: n.policyRef } : { label: n.label };
  if (n.description !== undefined) data.description = n.description;
  if (n.iconHint !== undefined) data.iconHint = n.iconHint;
  if (n.badges !== undefined) data.badges = n.badges;
  if (n.accentColor !== undefined) data.accentColor = n.accentColor;
  if (n.meta !== undefined) data.meta = n.meta;
  if (n.status !== undefined) data.status = n.status;
  return data;
}

/**
 * Choose the most natural handle sides for an edge given the source & target
 * absolute positions, when the source graph did not pin them explicitly.
 * Returns [sourceSide, targetSide] such that the edge exits the source toward
 * the target and enters the target from the opposite direction.
 */
export function autoHandleSides(
  src: { x: number; y: number },
  tgt: { x: number; y: number },
): [HandleSide, HandleSide] {
  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    // primarily horizontal
    return dx >= 0 ? ["right", "left"] : ["left", "right"];
  }
  // primarily vertical
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}

export function toFlow(graph: WorkflowGraph): { nodes: Node[]; edges: Edge[] } {
  const positionedNodes = graph.nodes.map((n, i) => ({
    ...n,
    resolvedPosition: n.position ?? computePosition(i, graph.direction),
  }));

  const nodes: Node[] = positionedNodes.map((n) => ({
    id: n.id,
    type: n.type.toLowerCase(),
    data: buildNodeData(n),
    position: n.resolvedPosition,
  }));

  const nodeIndex = new Map(positionedNodes.map((n) => [n.id, n]));
  const nodeTypeById = new Map(graph.nodes.map((n) => [n.id, n.type]));

  const edges: Edge[] = graph.edges.map((e) => {
    const src = nodeIndex.get(e.from);
    const tgt = nodeIndex.get(e.to);
    const [autoSrcSide, autoTgtSide]: [HandleSide, HandleSide] =
      src && tgt ? autoHandleSides(src.resolvedPosition, tgt.resolvedPosition) : ["right", "left"];
    const srcSide: HandleSide = e.sourceHandle ?? autoSrcSide;
    const tgtSide: HandleSide = e.targetHandle ?? autoTgtSide;
    return {
      id: e.id,
      source: e.from,
      target: e.to,
      label: e.label,
      type: nodeTypeById.get(e.from) === "DECISION" ? "decision" : undefined,
      sourceHandle: srcSide,
      targetHandle: tgtSide,
      // Edge-level hints for ReactFlow: even when handles are referenced by id,
      // these positions still inform path geometry / arrow orientation.
      data: {
        sourcePosition: SIDE_TO_POSITION[srcSide],
        targetPosition: SIDE_TO_POSITION[tgtSide],
      },
    };
  });

  return { nodes, edges };
}

const VALID_ACCENTS = new Set(["violet", "indigo", "amber", "sky", "rose", "zinc"]);
const VALID_STATUSES = new Set(["IDLE", "ACTIVE", "COMPLETED", "FAILED"]);
const VALID_SIDES = new Set<HandleSide>(["left", "right", "top", "bottom"]);

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readBadgesArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value.filter((b): b is string => typeof b === "string" && b.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

function readStringMap(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => typeof v === "string",
  ) as [string, string][];
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function readHandleSide(value: unknown): HandleSide | undefined {
  return typeof value === "string" && VALID_SIDES.has(value as HandleSide)
    ? (value as HandleSide)
    : undefined;
}

/**
 * Convert ReactFlow nodes/edges back into the persisted WorkflowGraph shape,
 * preserving every optional field that `toFlow` originally surfaced on
 * `node.data` / `edge.sourceHandle` / `edge.targetHandle`. Without this, an
 * edit→save round-trip silently strips description / badges / iconHint /
 * accentColor / meta / status / position / handle sides.
 */
export function convertFlowToWorkflowGraph(
  nodes: Node[],
  edges: Edge[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const graphNodes: GraphNode[] = nodes.map((n) => {
    const type = toNodeType(n.type);
    const data = (n.data ?? {}) as Record<string, unknown>;
    const node: GraphNode = {
      id: n.id,
      type,
      label: typeof data.label === "string" ? data.label : "",
    };
    if (type === "ACTION") {
      const policyRef = readOptionalString(data.policyRef);
      if (policyRef !== undefined) node.policyRef = policyRef;
    }
    const description = readOptionalString(data.description);
    if (description !== undefined) node.description = description;
    const iconHint = readOptionalString(data.iconHint);
    if (iconHint !== undefined) node.iconHint = iconHint;
    const badges = readBadgesArray(data.badges);
    if (badges !== undefined) node.badges = badges;
    const accentColor = readOptionalString(data.accentColor);
    if (accentColor !== undefined && VALID_ACCENTS.has(accentColor)) {
      node.accentColor = accentColor as GraphNode["accentColor"];
    }
    const meta = readStringMap(data.meta);
    if (meta !== undefined) node.meta = meta;
    const status = readOptionalString(data.status);
    if (status !== undefined && VALID_STATUSES.has(status)) {
      node.status = status as GraphNode["status"];
    }
    if (n.position && typeof n.position.x === "number" && typeof n.position.y === "number") {
      node.position = { x: n.position.x, y: n.position.y };
    }
    return node;
  });

  const graphEdges: GraphEdge[] = edges.map((e) => {
    const edge: GraphEdge = {
      id: e.id,
      from: e.source,
      to: e.target,
    };
    if (typeof e.label === "string" && e.label.length > 0) edge.label = e.label;
    const sourceHandle = readHandleSide(e.sourceHandle);
    if (sourceHandle !== undefined) edge.sourceHandle = sourceHandle;
    const targetHandle = readHandleSide(e.targetHandle);
    if (targetHandle !== undefined) edge.targetHandle = targetHandle;
    return edge;
  });

  return { nodes: graphNodes, edges: graphEdges };
}
