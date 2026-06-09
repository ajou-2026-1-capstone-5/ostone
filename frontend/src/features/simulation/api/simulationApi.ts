import { customFetch } from "@/shared/api/mutator";
import { requireApiData, selectApiData } from "@/shared/api";
import type {
  ConsultationChatMessage as ChatMessage,
  ConsultationChatSession as ChatSession,
} from "@/entities/chat";
import type { LlmToolWorkflowPayload } from "@/entities/workflow";

export interface SimulationSessionDetail {
  session: ChatSession;
  messages: ChatMessage[];
  matchedWorkflow: LlmToolWorkflowPayload | null;
  slotValues: Record<string, unknown> | null;
  slots: Array<Record<string, unknown>>;
  feedback?: SimulationFeedbackSession;
}

export interface SimulationSessionPage {
  content: ChatSession[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CreateSimulationSessionPayload {
  customerName?: string;
  workflowDefinitionId?: number;
}

export interface SendSimulationMessagePayload {
  content: string;
}

export type SimulationFeedbackType =
  | "INTENT_MISMATCH"
  | "MISSING_SLOT_QUESTION"
  | "INAPPROPRIATE_RESPONSE"
  | "POLICY_CONDITION_MISSING"
  | "RISK_HANDOFF_REQUIRED"
  | "WORKFLOW_BRANCH_ERROR"
  | "OTHER";

export type SimulationFeedbackSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SimulationFeedbackStatus = "OPEN" | "CANDIDATE_CREATED" | "RESOLVED" | "DISMISSED";

export type SimulationImprovementCandidateType =
  | "INTENT_DESCRIPTION_EXAMPLE"
  | "SLOT_QUESTION"
  | "POLICY_CONDITION"
  | "RISK_RULE"
  | "WORKFLOW_STATE_TRANSITION"
  | "HANDOFF_CONDITION"
  | "RESPONSE_COPY"
  | "OTHER";

export type SimulationImprovementCandidateTargetType =
  | "INTENT"
  | "SLOT"
  | "POLICY"
  | "RISK_RULE"
  | "WORKFLOW"
  | "HANDOFF"
  | "RESPONSE"
  | "UNKNOWN";

export type SimulationImprovementCandidateStatus =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "APPLIED"
  | "REJECTED";

export type SimulationPatchValidationStatus = "VALID" | "INVALID" | "LEGACY" | "NONE";

export interface SimulationPatchOperationView {
  operationType: string;
  kind: "ELEMENT" | "WORKFLOW_NODE" | "WORKFLOW_TRANSITION";
  targetCategory: string | null;
  targetCode: string | null;
  targetId: number | null;
  value: string | null;
  nodeId: string | null;
  nodeType: string | null;
  slotCode: string | null;
  prompt: string | null;
  from: string | null;
  to: string | null;
  condition: string | null;
  reason: string | null;
  targetComplete: boolean;
}

export type SimulationGoldenCaseReplayStatus = "PASS" | "FAIL";

export interface SimulationFeedback {
  id: number;
  workspaceId: number;
  sessionId: number;
  chatMessageId: number | null;
  feedbackType: SimulationFeedbackType;
  description: string;
  expectedBehavior: string;
  severity: SimulationFeedbackSeverity;
  status: SimulationFeedbackStatus;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface SimulationFeedbackSession {
  items: SimulationFeedback[];
  messageFeedbackCounts: Record<string, number>;
}

export interface SimulationFeedbackPage {
  content: SimulationFeedback[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CreateSimulationFeedbackPayload {
  chatMessageId?: number | null;
  feedbackType: SimulationFeedbackType;
  description: string;
  expectedBehavior: string;
  severity: SimulationFeedbackSeverity;
}

export interface SimulationImprovementCandidate {
  id: number;
  workspaceId: number;
  domainPackVersionId: number;
  feedbackId: number;
  sessionId: number;
  chatMessageId: number | null;
  candidateType: SimulationImprovementCandidateType;
  targetElementType: SimulationImprovementCandidateTargetType;
  targetElementId: number | null;
  targetElementKey: string | null;
  beforeSummary: string;
  afterSummary: string;
  evidenceSummary: string;
  reviewSessionId: number | null;
  reviewTaskId: number | null;
  appliedDomainPackVersionId: number | null;
  draftPatchJson: string;
  decisionReason: string | null;
  decidedBy: number | null;
  decidedAt: string | null;
  status: SimulationImprovementCandidateStatus;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  patchSchemaVersion: string | null;
  patchSummary: string | null;
  patchValidationStatus: SimulationPatchValidationStatus;
  patchValidationErrors: string[];
  operations: SimulationPatchOperationView[];
}

export interface SimulationImprovementCandidatePage {
  content: SimulationImprovementCandidate[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface SimulationGoldenCaseReplayResult {
  id: number;
  workspaceId: number;
  goldenCaseId: number;
  domainPackVersionId: number;
  replaySessionId: number;
  status: SimulationGoldenCaseReplayStatus;
  expectedJson: string;
  actualJson: string;
  failureSummary: string | null;
  createdBy: number;
  createdAt: string;
}

export interface SimulationGoldenCase {
  id: number;
  workspaceId: number;
  sourceSessionId: number;
  sourceDomainPackVersionId: number;
  name: string;
  inputMessagesJson: string;
  expectedJson: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  latestReplayResult: SimulationGoldenCaseReplayResult | null;
}

export interface SimulationGoldenCasePage {
  content: SimulationGoldenCase[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface SimulationGoldenCaseReplayResultPage {
  content: SimulationGoldenCaseReplayResult[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CreateSimulationImprovementCandidatePayload {
  targetElementType?: SimulationImprovementCandidateTargetType;
  targetElementId?: number | null;
  targetElementKey?: string;
  beforeSummary?: string;
  afterSummary?: string;
}

export interface UpdateSimulationImprovementCandidateStatusPayload {
  status: SimulationImprovementCandidateStatus;
}

export interface ReviewSimulationImprovementCandidatePayload {
  reason?: string;
}

export interface RejectSimulationImprovementCandidatePayload {
  reason: string;
}

export interface CreateSimulationGoldenCasePayload {
  name?: string;
  expectedIntentCode?: string | null;
  expectedWorkflowCode?: string | null;
  expectedCurrentState?: string | null;
  expectedActionType?: string | null;
  expectedSlotValues?: Record<string, unknown> | null;
}

export interface ReplaySimulationGoldenCasePayload {
  domainPackVersionId: number;
}

type MaybeWrapped<T> = T | { data?: T };

function unwrapSessionPage(response: MaybeWrapped<SimulationSessionPage>): SimulationSessionPage {
  const data = selectApiData<SimulationSessionPage>(response);
  return {
    content: data?.content ?? [],
    page: data?.page ?? 0,
    size: data?.size ?? 20,
    totalElements: data?.totalElements ?? data?.content?.length ?? 0,
    totalPages: data?.totalPages ?? 0,
  };
}

function unwrapGoldenCasePage(
  response: MaybeWrapped<SimulationGoldenCasePage>,
): SimulationGoldenCasePage {
  const data = selectApiData<SimulationGoldenCasePage>(response);
  return {
    content: data?.content ?? [],
    page: data?.page ?? 0,
    size: data?.size ?? 20,
    totalElements: data?.totalElements ?? data?.content?.length ?? 0,
    totalPages: data?.totalPages ?? 0,
  };
}

function unwrapReplayResultPage(
  response: MaybeWrapped<SimulationGoldenCaseReplayResultPage>,
): SimulationGoldenCaseReplayResultPage {
  const data = selectApiData<SimulationGoldenCaseReplayResultPage>(response);
  return {
    content: data?.content ?? [],
    page: data?.page ?? 0,
    size: data?.size ?? 20,
    totalElements: data?.totalElements ?? data?.content?.length ?? 0,
    totalPages: data?.totalPages ?? 0,
  };
}

// OpenAPI 미생성 endpoint라 generated client 대신 customFetch wrapper를 둔다.
export const simulationApi = {
  listSessions: async (
    workspaceId: number,
    params: { page?: number; size?: number } = {},
  ): Promise<SimulationSessionPage> => {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.size !== undefined) searchParams.set("size", String(params.size));
    const query = searchParams.toString();
    const response = await customFetch<MaybeWrapped<SimulationSessionPage>>(
      `/api/v1/workspaces/${workspaceId}/simulation/sessions${query ? `?${query}` : ""}`,
      { method: "GET" },
    );
    return unwrapSessionPage(response);
  },

  createSession: async (
    workspaceId: number,
    payload: CreateSimulationSessionPayload,
  ): Promise<SimulationSessionDetail> => {
    const response = await customFetch<MaybeWrapped<SimulationSessionDetail>>(
      `/api/v1/workspaces/${workspaceId}/simulation/sessions`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return requireApiData<SimulationSessionDetail>(
      response,
      "시뮬레이션 세션 생성 응답을 확인할 수 없습니다.",
    );
  },

  getSession: async (workspaceId: number, sessionId: number): Promise<SimulationSessionDetail> => {
    const response = await customFetch<MaybeWrapped<SimulationSessionDetail>>(
      `/api/v1/workspaces/${workspaceId}/simulation/sessions/${sessionId}`,
      { method: "GET" },
    );
    return requireApiData<SimulationSessionDetail>(
      response,
      "시뮬레이션 세션 상세 응답을 확인할 수 없습니다.",
    );
  },

  sendMessage: async (
    workspaceId: number,
    sessionId: number,
    payload: SendSimulationMessagePayload,
  ): Promise<SimulationSessionDetail> => {
    const response = await customFetch<MaybeWrapped<SimulationSessionDetail>>(
      `/api/v1/workspaces/${workspaceId}/simulation/sessions/${sessionId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return requireApiData<SimulationSessionDetail>(
      response,
      "시뮬레이션 메시지 응답을 확인할 수 없습니다.",
    );
  },

  createFeedback: async (
    workspaceId: number,
    sessionId: number,
    payload: CreateSimulationFeedbackPayload,
  ): Promise<SimulationSessionDetail> => {
    const response = await customFetch<MaybeWrapped<SimulationSessionDetail>>(
      `/api/v1/workspaces/${workspaceId}/simulation/sessions/${sessionId}/feedback`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return requireApiData<SimulationSessionDetail>(
      response,
      "시뮬레이션 피드백 응답을 확인할 수 없습니다.",
    );
  },

  listFeedback: async (
    workspaceId: number,
    params: { status?: SimulationFeedbackStatus | ""; page?: number; size?: number } = {},
  ): Promise<SimulationFeedbackPage> => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set("status", params.status);
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.size !== undefined) searchParams.set("size", String(params.size));
    const query = searchParams.toString();
    const path = query
      ? `/api/v1/workspaces/${workspaceId}/simulation/feedback?${query}`
      : `/api/v1/workspaces/${workspaceId}/simulation/feedback`;
    const response = await customFetch<MaybeWrapped<SimulationFeedbackPage>>(path, {
      method: "GET",
    });
    const data = selectApiData<SimulationFeedbackPage>(response);
    return {
      content: data?.content ?? [],
      page: data?.page ?? 0,
      size: data?.size ?? 20,
      totalElements: data?.totalElements ?? data?.content?.length ?? 0,
      totalPages: data?.totalPages ?? 0,
    };
  },

  createImprovementCandidate: async (
    workspaceId: number,
    feedbackId: number,
    payload: CreateSimulationImprovementCandidatePayload = {},
  ): Promise<SimulationImprovementCandidate> => {
    const response = await customFetch<MaybeWrapped<SimulationImprovementCandidate>>(
      `/api/v1/workspaces/${workspaceId}/simulation/improvement-candidates/from-feedback/${feedbackId}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return requireApiData<SimulationImprovementCandidate>(
      response,
      "시뮬레이션 개선 후보 응답을 확인할 수 없습니다.",
    );
  },

  listImprovementCandidates: async (
    workspaceId: number,
    params: {
      status?: SimulationImprovementCandidateStatus | "";
      page?: number;
      size?: number;
    } = {},
  ): Promise<SimulationImprovementCandidatePage> => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set("status", params.status);
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.size !== undefined) searchParams.set("size", String(params.size));
    const query = searchParams.toString();
    const path = query
      ? `/api/v1/workspaces/${workspaceId}/simulation/improvement-candidates?${query}`
      : `/api/v1/workspaces/${workspaceId}/simulation/improvement-candidates`;
    const response = await customFetch<MaybeWrapped<SimulationImprovementCandidatePage>>(path, {
      method: "GET",
    });
    const data = selectApiData<SimulationImprovementCandidatePage>(response);
    return {
      content: data?.content ?? [],
      page: data?.page ?? 0,
      size: data?.size ?? 20,
      totalElements: data?.totalElements ?? data?.content?.length ?? 0,
      totalPages: data?.totalPages ?? 0,
    };
  },

  getImprovementCandidate: async (
    workspaceId: number,
    candidateId: number,
  ): Promise<SimulationImprovementCandidate> => {
    const response = await customFetch<MaybeWrapped<SimulationImprovementCandidate>>(
      `/api/v1/workspaces/${workspaceId}/simulation/improvement-candidates/${candidateId}`,
      { method: "GET" },
    );
    return requireApiData<SimulationImprovementCandidate>(
      response,
      "시뮬레이션 개선 후보 상세 응답을 확인할 수 없습니다.",
    );
  },

  updateImprovementCandidateStatus: async (
    workspaceId: number,
    candidateId: number,
    payload: UpdateSimulationImprovementCandidateStatusPayload,
  ): Promise<SimulationImprovementCandidate> => {
    const response = await customFetch<MaybeWrapped<SimulationImprovementCandidate>>(
      `/api/v1/workspaces/${workspaceId}/simulation/improvement-candidates/${candidateId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return requireApiData<SimulationImprovementCandidate>(
      response,
      "시뮬레이션 개선 후보 상태 응답을 확인할 수 없습니다.",
    );
  },

  approveImprovementCandidate: async (
    workspaceId: number,
    candidateId: number,
    payload: ReviewSimulationImprovementCandidatePayload = {},
  ): Promise<SimulationImprovementCandidate> => {
    const response = await customFetch<MaybeWrapped<SimulationImprovementCandidate>>(
      `/api/v1/workspaces/${workspaceId}/simulation/improvement-candidates/${candidateId}/approve`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return requireApiData<SimulationImprovementCandidate>(
      response,
      "시뮬레이션 개선 후보 승인 응답을 확인할 수 없습니다.",
    );
  },

  rejectImprovementCandidate: async (
    workspaceId: number,
    candidateId: number,
    payload: RejectSimulationImprovementCandidatePayload,
  ): Promise<SimulationImprovementCandidate> => {
    const response = await customFetch<MaybeWrapped<SimulationImprovementCandidate>>(
      `/api/v1/workspaces/${workspaceId}/simulation/improvement-candidates/${candidateId}/reject`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return requireApiData<SimulationImprovementCandidate>(
      response,
      "시뮬레이션 개선 후보 반려 응답을 확인할 수 없습니다.",
    );
  },

  listGoldenCases: async (
    workspaceId: number,
    params: { page?: number; size?: number } = {},
  ): Promise<SimulationGoldenCasePage> => {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.size !== undefined) searchParams.set("size", String(params.size));
    const query = searchParams.toString();
    const path = query
      ? `/api/v1/workspaces/${workspaceId}/simulation/golden-cases?${query}`
      : `/api/v1/workspaces/${workspaceId}/simulation/golden-cases`;
    const response = await customFetch<MaybeWrapped<SimulationGoldenCasePage>>(path, {
      method: "GET",
    });
    return unwrapGoldenCasePage(response);
  },

  createGoldenCase: async (
    workspaceId: number,
    sessionId: number,
    payload: CreateSimulationGoldenCasePayload,
  ): Promise<SimulationGoldenCase> => {
    const response = await customFetch<MaybeWrapped<SimulationGoldenCase>>(
      `/api/v1/workspaces/${workspaceId}/simulation/sessions/${sessionId}/golden-cases`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return requireApiData<SimulationGoldenCase>(
      response,
      "검증 케이스 생성 응답을 확인할 수 없습니다.",
    );
  },

  replayGoldenCase: async (
    workspaceId: number,
    goldenCaseId: number,
    payload: ReplaySimulationGoldenCasePayload,
  ): Promise<SimulationGoldenCaseReplayResult> => {
    const response = await customFetch<MaybeWrapped<SimulationGoldenCaseReplayResult>>(
      `/api/v1/workspaces/${workspaceId}/simulation/golden-cases/${goldenCaseId}/replays`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return requireApiData<SimulationGoldenCaseReplayResult>(
      response,
      "검증 케이스 replay 응답을 확인할 수 없습니다.",
    );
  },

  listGoldenCaseReplays: async (
    workspaceId: number,
    goldenCaseId: number,
    params: { page?: number; size?: number } = {},
  ): Promise<SimulationGoldenCaseReplayResultPage> => {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.size !== undefined) searchParams.set("size", String(params.size));
    const query = searchParams.toString();
    const path = query
      ? `/api/v1/workspaces/${workspaceId}/simulation/golden-cases/${goldenCaseId}/replays?${query}`
      : `/api/v1/workspaces/${workspaceId}/simulation/golden-cases/${goldenCaseId}/replays`;
    const response = await customFetch<MaybeWrapped<SimulationGoldenCaseReplayResultPage>>(path, {
      method: "GET",
    });
    return unwrapReplayResultPage(response);
  },
};
