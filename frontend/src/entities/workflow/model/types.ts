export interface WorkflowSummary {
  id: number;
  workflowCode: string;
  name: string;
  description: string | null;
  initialState: string | null;
  terminalStatesJson: string;
  createdAt: string;
  updatedAt: string;
}

export type GraphNodeType = "START" | "ACTION" | "DECISION" | "ANSWER" | "HANDOFF" | "TERMINAL";

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  policyRef?: string;
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

export interface WorkflowDetail {
  id: number;
  workflowCode: string;
  name: string;
  description: string | null;
  graphJson: WorkflowGraph;
  initialState: string | null;
  terminalStatesJson: string;
  evidenceJson: string;
  metaJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateWorkflowRequest {
  name: string;
  description?: string | null;
  graphJson: WorkflowGraph;
}
