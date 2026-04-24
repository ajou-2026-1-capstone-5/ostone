import type { Node, Edge } from "@xyflow/react";
import type { GraphNode, GraphEdge, GraphNodeType } from "../model/types";

export function convertFlowToWorkflowGraph(
  nodes: Node[],
  edges: Edge[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const graphNodes: GraphNode[] = nodes.map((n) => ({
    id: n.id,
    type: (n.type?.toUpperCase() ?? "ACTION") as GraphNodeType,
    label: typeof n.data?.label === "string" ? n.data.label : "",
    policyRef:
      typeof n.data?.policyRef === "string" ? n.data.policyRef || undefined : undefined,
  }));

  const graphEdges: GraphEdge[] = edges.map((e) => ({
    id: e.id,
    from: e.source,
    to: e.target,
    label: typeof e.label === "string" ? e.label || undefined : undefined,
  }));

  return { nodes: graphNodes, edges: graphEdges };
}
