import type { Node, Edge } from "@xyflow/react";
import type { WorkflowGraph } from "@/entities/workflow";
import { convertFlowToWorkflowGraph } from "@/entities/workflow";

export function toWorkflowGraph(
  nodes: Node[],
  edges: Edge[],
  direction: WorkflowGraph["direction"],
): WorkflowGraph {
  const { nodes: graphNodes, edges: graphEdges } = convertFlowToWorkflowGraph(nodes, edges);
  return { direction, nodes: graphNodes, edges: graphEdges };
}
