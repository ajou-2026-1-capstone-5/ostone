import type { Node, Edge } from "@xyflow/react";
import type { WorkflowGraph } from "../../../entities/workflow";

const NODE_GAP_X = 200;
const NODE_GAP_Y = 120;
const COLUMNS_FOR_TB = 4;

function computePosition(
  index: number,
  direction: WorkflowGraph["direction"],
): { x: number; y: number } {
  if (direction === "TB") {
    const col = index % COLUMNS_FOR_TB;
    const row = Math.floor(index / COLUMNS_FOR_TB);
    return { x: col * NODE_GAP_X, y: row * NODE_GAP_Y };
  }
  return { x: index * NODE_GAP_X, y: (index % 2) * NODE_GAP_Y };
}

export function toFlow(graph: WorkflowGraph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n, i) => ({
    id: n.id,
    type: n.type.toLowerCase(),
    data: { label: n.label },
    position: computePosition(i, graph.direction),
  }));

  const edgeIdCounts = new Map<string, number>();
  const edges: Edge[] = graph.edges.map((e) => {
    const baseId = `${e.from}->${e.to}:${e.label ?? "unlabeled"}`;
    const count = edgeIdCounts.get(baseId) ?? 0;
    edgeIdCounts.set(baseId, count + 1);

    return {
      id: `${baseId}#${count + 1}`,
      source: e.from,
      target: e.to,
      label: e.label,
    };
  });

  return { nodes, edges };
}
