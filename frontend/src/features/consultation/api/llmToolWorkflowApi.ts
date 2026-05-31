import { customFetch } from "@/shared/api/mutator";

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
  terminalStates?: unknown;
  intentCode?: string | null;
  intentName?: string | null;
  confidence?: number | null;
  confidenceScore?: number | null;
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
  // 매칭 워크플로우 바는 보조 정보 패널이다. 서버 오류(5xx)·네트워크 실패·미매칭(404/400)
  // 어느 경우든 "표시할 워크플로우 없음"으로 degrade하여 null을 반환하고, 패널만 조용히 숨긴다.
  try {
    const payload = await customFetch<LlmToolWorkflowPayload>(
      `/api/v1/consultation/sessions/${sessionId}/matched-workflow`,
      { method: "GET" },
    );
    return isMatchedWorkflow(payload) ? payload : null;
  } catch (error) {
    console.warn("matched-workflow 조회 실패 — 바를 숨깁니다.", error);
    return null;
  }
}
