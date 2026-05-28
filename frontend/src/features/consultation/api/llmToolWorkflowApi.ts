import { customFetch } from "@/shared/api/mutator";
import { ApiRequestError } from "@/shared/api";

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
}

export type MatchedWorkflow = LlmToolWorkflowPayload & {
  workflowDefinitionId: number;
};

export function isMatchedWorkflow(
  payload: LlmToolWorkflowPayload | null,
): payload is MatchedWorkflow {
  return !!payload && payload.workflowDefinitionId != null;
}

export async function getCurrentWorkflow(sessionId: number): Promise<MatchedWorkflow | null> {
  try {
    const payload = await customFetch<LlmToolWorkflowPayload>(
      `/api/v1/llm-tools/sessions/${sessionId}/workflow`,
      { method: "GET" },
    );
    return isMatchedWorkflow(payload) ? payload : null;
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}
