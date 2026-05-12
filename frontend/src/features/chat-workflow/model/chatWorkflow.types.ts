export interface DomainPackInfo {
  name: string;
  version: string;
  publishedAt?: string;
}

export interface ScenarioInfo {
  name: string;
}

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

export interface WorkflowState {
  currentNodeId: string | null;
  status: string;
  context: Record<string, unknown>;
}

export interface DecisionLogEntry {
  id: string;
  step: string;
  action: string;
  reason: string;
}

export interface ChatWorkflowDemoState {
  messages: ChatMessage[];
  workflow: WorkflowState;
  decisionLog: DecisionLogEntry[];
  domainPack: DomainPackInfo | null;
  scenario: ScenarioInfo | null;
}
