export type TerminalState = string;

export interface LlmToolWorkflowPayload {
  sessionId: number | null;
  workspaceId: number | null;
  domainPackId: number | null;
  domainPackVersionId: number | null;
  executionId: number | null;
  executionStatus: string | null;
  currentState: string | null;
  workflowDefinitionId: number | null;
  workflowCode: string | null;
  workflowName: string | null;
  workflowDescription: string | null;
  graphJson?: unknown;
  initialState?: string | null;
  terminalStates?: TerminalState[] | null;
  intentCode?: string | null;
  intentName?: string | null;
}

export type MatchedWorkflow = LlmToolWorkflowPayload & {
  workflowDefinitionId: number;
};
