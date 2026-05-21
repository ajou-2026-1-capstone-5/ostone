export type {
  UpdateWorkflowRequest,
  WorkflowDefinitionDetail as WorkflowDetail,
  WorkflowDefinitionSummary as WorkflowSummary,
} from "@/shared/api/generated/zod";

export type GraphNodeType = "START" | "ACTION" | "DECISION" | "ANSWER" | "HANDOFF" | "TERMINAL";

export type GraphNodeAccent = "violet" | "indigo" | "amber" | "sky" | "rose" | "zinc";

export type GraphNodeRuntimeStatus = "IDLE" | "ACTIVE" | "COMPLETED" | "FAILED";

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  policyRef?: string;
  position?: { x: number; y: number };
  description?: string;
  iconHint?: string;
  badges?: string[];
  accentColor?: GraphNodeAccent;
  meta?: Record<string, string>;
  status?: GraphNodeRuntimeStatus;
}

export type HandleSide = "left" | "right" | "top" | "bottom";

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  sourceHandle?: HandleSide;
  targetHandle?: HandleSide;
}

export interface WorkflowGraph {
  direction: "LR" | "TB";
  nodes: GraphNode[];
  edges: GraphEdge[];
  [key: string]: unknown;
}
