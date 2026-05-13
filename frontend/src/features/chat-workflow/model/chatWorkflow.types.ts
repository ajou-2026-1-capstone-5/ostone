export interface DemoDomainPack {
  id: string;
  name: string;
  version: string;
  status: string;
  intents: DemoIntent[];
  policies: DemoPolicy[];
  risks: DemoRisk[];
}

export interface DemoIntent {
  id: string;
  name: string;
  description: string;
}

export interface DemoPolicy {
  id: string;
  name: string;
  description: string;
  severity: string;
}

export interface DemoRisk {
  id: string;
  name: string;
  description: string;
  level: string;
}

export interface DemoWorkflow {
  id: string;
  name: string;
  description: string;
  states: string[];
  transitions: DemoWorkflowTransition[];
}

export interface DemoWorkflowTransition {
  from: string;
  to: string;
  on: string;
}

export interface DemoChatSession {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
}

export interface DemoChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface DemoExecution {
  id: string;
  status: string;
  currentState: string;
  currentNodeId: string;
  intent: string;
  slotValues: Record<string, string | number>;
  missingSlots: string[];
  policyHits: DemoPolicyHit[];
  riskHits: DemoRiskHit[];
}

export interface DemoPolicyHit {
  policyId: string;
  policyName: string;
  result: string;
  detail: string;
}

export interface DemoRiskHit {
  riskId: string;
  riskName: string;
  result: string;
  detail: string;
}

export interface DemoDecisionLogEntry {
  id: string;
  step: number;
  messageId: string;
  eventType: string;
  stateFrom: string;
  stateTo: string;
  decision: string;
  confidence: number;
  reason: string;
}

export interface DemoChatWorkflowResponse {
  domainPack: DemoDomainPack;
  workflow: DemoWorkflow;
  chatSession: DemoChatSession;
  messages: DemoChatMessage[];
  execution: DemoExecution;
  decisionLogs: DemoDecisionLogEntry[];
}

export interface ChatWorkflowDemoState {
  response: DemoChatWorkflowResponse | null;
  selectedMessageId: string | null;
  loading: boolean;
  error: string | null;
}
