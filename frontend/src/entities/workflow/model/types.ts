export type {
  UpdateWorkflowRequest,
  WorkflowDefinitionDetail as WorkflowDetail,
  WorkflowDefinitionSummary as WorkflowSummary,
} from "@/shared/api/generated/zod";

export type GraphNodeType = "START" | "ACTION" | "DECISION" | "ANSWER" | "HANDOFF" | "TERMINAL";

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  policyRef?: string;
  position?: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface WorkflowGraph {
  direction: "LR" | "TB";
  nodes: GraphNode[];
  edges: GraphEdge[];
}
