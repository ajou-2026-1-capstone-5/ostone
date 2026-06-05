import {
  generateDraftResponse,
  getMessages,
  sendMessage,
  updateStatus,
} from "@/shared/api/generated/endpoints/consultation-controller/consultation-controller";
import { getQueue } from "@/shared/api/generated/endpoints/workspace-consultation-queue-controller/workspace-consultation-queue-controller";
import {
  assignSession,
  getSessions,
  releaseSession,
  updateResponseMode,
} from "@/shared/api/generated/endpoints/counselor-session-controller/counselor-session-controller";
import { customFetch } from "@/shared/api/mutator";
import { requireApiData, selectApiData } from "@/shared/api";
import type { GetSessionsParams } from "@/shared/api/generated/zod";
import type {
  ConsultationChatMessage,
  ConsultationChatSession,
  ConsultationResponseMode,
} from "@/entities/chat";

// 상담 endpoint는 가능한 한 generated controller에 위임한다:
// queue(getQueue) / sessions(getSessions) / messages(getMessages) /
// assign·release·response-mode(counselor-session) / draft-response(consultation).
// 단, dashboard workflow rankings·bottleneck analysis와, from/to 기간 필터가 필요한 metrics는
// generated 시그니처가 해당 파라미터를 노출하지 않아 customFetch 직접 호출을 유지한다.

export type ChatSession = ConsultationChatSession;
export type ChatMessage = ConsultationChatMessage;
export interface ChatMessagePage {
  content: ChatMessage[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export type ConsultationSessionStatus = "OPEN" | "ACTIVE" | "RESOLVED" | "COMPLETED";
export type { ConsultationResponseMode };
export type ResolutionOutcome = "RESOLVED" | "CUSTOMER_LEFT" | "PENDING" | "FOLLOW_UP_REQUIRED";
export interface ChatSessionPage {
  content: ChatSession[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export interface ChatSessionListParams {
  status?: string;
  keyword?: string;
  startedFrom?: string;
  startedTo?: string;
  assignedCounselorId?: number;
  page?: number;
  size?: number;
}
export interface UpdateSessionStatusPayload {
  status: ConsultationSessionStatus;
  resolutionOutcome?: ResolutionOutcome;
  resolutionReason?: string;
  followUpRequired?: boolean;
}
export type ConsultationQueueEventType = "SESSION_UPSERTED" | "SESSION_REMOVED";
export interface ConsultationQueueEvent {
  type: ConsultationQueueEventType;
  session: ChatSession;
  occurredAt?: string;
}

export interface ConsultationMetrics {
  workspaceId: number;
  periodStart: string;
  periodEnd: string;
  totalConsultationCount: number;
  completedConsultationCount: number;
  averageFirstResponseSeconds: number | null;
  averageLlmFirstResponseSeconds: number | null;
  averageHumanFirstResponseSeconds: number | null;
  llmHandledCount: number;
  humanInterventionCount: number;
  unresolvedSessionCount: number;
  comparison: ConsultationMetricsComparison | null;
  coverage: ConsultationCoverageMetrics | null;
  handledTodayCount: number;
  llmHandledTodayCount: number;
  humanHandledTodayCount: number;
}

export interface ConsultationMetricsComparison {
  totalConsultationCountChangeRate: number | null;
  completedConsultationCountChangeRate: number | null;
  averageFirstResponseSecondsChangeRate: number | null;
  averageLlmFirstResponseSecondsChangeRate: number | null;
  averageHumanFirstResponseSecondsChangeRate: number | null;
  llmHandledCountChangeRate: number | null;
  humanInterventionCountChangeRate: number | null;
  unresolvedSessionCountChangeRate: number | null;
}

export interface ConsultationCoverageMetrics {
  workflowMatchedCount: number;
  workflowMatchRate: number | null;
  intentClassificationSuccessCount: number;
  intentClassificationSuccessRate: number | null;
  lowConfidenceCount: number;
  lowConfidenceRate: number | null;
  unmatchedSessionCount: number;
  autoCompletedWorkflowCount: number;
  humanHandoffRate: number | null;
  llmOnlyProcessingRate: number | null;
  measurementStatus: "READY" | "NEEDS_INSTRUMENTATION";
  measurementMessage: string;
  trend: ConsultationCoverageTrendPoint[];
}

export interface ConsultationCoverageTrendPoint {
  date: string;
  totalConsultationCount: number;
  workflowMatchedCount: number;
  workflowMatchRate: number | null;
}

export interface ConsultationMetricsParams {
  from?: string;
  to?: string;
}

export interface WorkspaceWorkflowRanking {
  rank: number;
  workflowDefinitionId: number | null;
  domainPackId: number | null;
  domainPackVersionId: number | null;
  workflowCode: string | null;
  workflowName: string;
  executionCount: number;
  shareRate: number;
  completedCount: number;
  failedCount: number;
  runningCount: number;
  completionRate: number;
  failureRate: number;
  averageHandlingSeconds: number | null;
  humanInterventionRate: number;
  changeRate: number | null;
  surging: boolean;
  detailPath: string | null;
}

export interface WorkspaceWorkflowRankingResponse {
  workspaceId: number;
  periodStart: string;
  periodEnd: string;
  totalConsultationCount: number;
  rankings: WorkspaceWorkflowRanking[];
  topRankings: WorkspaceWorkflowRanking[];
}

export interface WorkflowTransitionMetric {
  stateFrom: string | null;
  stateTo: string;
  passCount: number;
}

export interface WorkflowStateBottleneck {
  stateName: string;
  metricValue: number;
  executionCount: number;
  description: string;
}

export interface WorkflowHitMetric {
  name: string;
  count: number;
  stateName: string;
  description: string;
}

export interface WorkflowHumanInterventionMetric {
  stateName: string;
  count: number;
  description: string;
}

export interface WorkspaceWorkflowBottleneckAnalysis {
  workspaceId: number;
  workflowDefinitionId: number;
  periodStart: string;
  periodEnd: string;
  totalExecutionCount: number;
  completedCount: number;
  failedCount: number;
  runningCount: number;
  transitions: WorkflowTransitionMetric[];
  longestDwellState: WorkflowStateBottleneck | null;
  mostStoppedState: WorkflowStateBottleneck | null;
  stateMetrics: WorkflowHitMetric[];
  missingSlotTop: WorkflowHitMetric[];
  policyHitTop: WorkflowHitMetric[];
  riskHitTop: WorkflowHitMetric[];
  humanInterventionPoints: WorkflowHumanInterventionMetric[];
  improvementHints: string[];
}

export interface DraftResponse {
  content: string;
}

type SessionListResponse =
  | ChatSession[]
  | {
      data?: ChatSession[] | Partial<ChatSessionPage>;
      content?: ChatSession[];
      page?: number;
      size?: number;
      totalElements?: number;
      totalPages?: number;
    };

type MessageListResponse =
  | ChatMessage[]
  | {
      data?: ChatMessage[] | Partial<ChatMessagePage>;
      content?: ChatMessage[];
      page?: number;
      size?: number;
      totalElements?: number;
      totalPages?: number;
    };

const DEFAULT_MESSAGE_PAGE = 0;
const DEFAULT_MESSAGE_PAGE_SIZE = 50;
const MAX_MESSAGE_PAGE_SIZE = 100;

function normalizeMessagePage(page: number | null | undefined): number {
  if (typeof page !== "number" || !Number.isFinite(page)) return DEFAULT_MESSAGE_PAGE;
  return Math.max(DEFAULT_MESSAGE_PAGE, Math.floor(page));
}

function normalizeMessagePageSize(size: number | null | undefined): number {
  if (typeof size !== "number" || !Number.isFinite(size)) return DEFAULT_MESSAGE_PAGE_SIZE;
  return Math.min(MAX_MESSAGE_PAGE_SIZE, Math.max(1, Math.floor(size)));
}

function normalizeMessageTotalPages(totalPages: number | null | undefined): number | undefined {
  if (typeof totalPages !== "number" || !Number.isFinite(totalPages)) return undefined;
  return Math.max(0, Math.floor(totalPages));
}

function unwrapSessionPage(response: SessionListResponse): ChatSessionPage {
  const unwrapped = selectApiData<ChatSession[] | Partial<ChatSessionPage>>(response);
  if (Array.isArray(unwrapped)) {
    return {
      content: unwrapped,
      page: 0,
      size: unwrapped.length,
      totalElements: unwrapped.length,
      totalPages: unwrapped.length > 0 ? 1 : 0,
    };
  }

  const content = unwrapped?.content ?? [];
  return {
    content,
    page: unwrapped?.page ?? 0,
    size: unwrapped?.size ?? content.length,
    totalElements: unwrapped?.totalElements ?? content.length,
    totalPages: unwrapped?.totalPages ?? (content.length > 0 ? 1 : 0),
  };
}

function unwrapMessageList(response: MessageListResponse): ChatMessage[] {
  const unwrapped = selectApiData<ChatMessage[] | { content?: ChatMessage[] }>(response);
  if (Array.isArray(unwrapped)) return unwrapped;
  return unwrapped?.content ?? [];
}

function unwrapMessagePage(
  response: MessageListResponse,
  fallback: { page: number; size: number },
): ChatMessagePage {
  const fallbackPage = normalizeMessagePage(fallback.page);
  const fallbackSize = normalizeMessagePageSize(fallback.size);
  const unwrapped = selectApiData<ChatMessage[] | Partial<ChatMessagePage>>(response);
  if (Array.isArray(unwrapped)) {
    return {
      content: unwrapped,
      page: fallbackPage,
      size: fallbackSize,
      totalElements: unwrapped.length,
      totalPages: unwrapped.length > 0 ? 1 : 0,
    };
  }

  const content = unwrapped?.content ?? [];
  const totalElements = unwrapped?.totalElements ?? content.length;
  const page = normalizeMessagePage(unwrapped?.page ?? fallbackPage);
  const size = normalizeMessagePageSize(unwrapped?.size ?? fallbackSize);
  const totalPages =
    normalizeMessageTotalPages(unwrapped?.totalPages) ??
    (totalElements > 0 ? Math.ceil(totalElements / size) : 0);
  return {
    content,
    page,
    size,
    totalElements,
    totalPages,
  };
}

function toGetSessionsParams(params?: ChatSessionListParams): GetSessionsParams {
  const result: GetSessionsParams = {};
  if (params?.status) result.status = params.status;
  if (params?.keyword) result.keyword = params.keyword;
  if (params?.startedFrom) result.startedFrom = params.startedFrom;
  if (params?.startedTo) result.startedTo = params.startedTo;
  if (params?.assignedCounselorId !== undefined) {
    result.assignedCounselorId = params.assignedCounselorId;
  }
  if (params?.page !== undefined) result.page = params.page;
  if (params?.size !== undefined) result.size = params.size;
  return result;
}

async function fetchMessagePage(
  sessionId: number,
  params: { page?: number; size?: number } = {},
): Promise<ChatMessagePage> {
  const page = normalizeMessagePage(params.page);
  const size = normalizeMessagePageSize(params.size);
  const response = await getMessages(sessionId, { page, size });
  return unwrapMessagePage(response as unknown as MessageListResponse, { page, size });
}

export const consultationApi = {
  getQueue: async (workspaceId: number): Promise<ChatSession[]> => {
    const response = await getQueue(workspaceId);
    return selectApiData<ChatSession[]>(response as unknown as { data?: ChatSession[] }) ?? [];
  },

  getSessions: async (
    workspaceId: number,
    params?: ChatSessionListParams,
  ): Promise<ChatSession[]> => {
    const page = await consultationApi.getSessionPage(workspaceId, params);
    return page.content;
  },

  getSessionPage: async (
    workspaceId: number,
    params?: ChatSessionListParams,
  ): Promise<ChatSessionPage> => {
    const response = await getSessions(workspaceId, toGetSessionsParams(params));
    return unwrapSessionPage(response as unknown as SessionListResponse);
  },

  getMessages: async (
    sessionId: number,
    params?: { page?: number; size?: number },
  ): Promise<ChatMessage[]> => {
    if (!params) {
      return unwrapMessageList(await getMessages(sessionId));
    }
    return (await fetchMessagePage(sessionId, params)).content;
  },

  getMessagePage: async (
    sessionId: number,
    params?: { page?: number; size?: number },
  ): Promise<ChatMessagePage> => {
    return fetchMessagePage(sessionId, params);
  },

  sendMessage: async (
    sessionId: number,
    content: string,
    isNote: boolean = false,
  ): Promise<ChatMessage> => {
    return requireApiData<ChatMessage>(
      await sendMessage(sessionId, { content, isNote }),
      "메시지 전송 응답을 확인할 수 없습니다.",
    );
  },

  updateStatus: async (
    sessionId: number,
    statusOrPayload: ConsultationSessionStatus | UpdateSessionStatusPayload,
  ): Promise<ChatSession> => {
    const payload =
      typeof statusOrPayload === "string" ? { status: statusOrPayload } : statusOrPayload;
    return requireApiData<ChatSession>(
      (await updateStatus(sessionId, payload)) as unknown as { data: ChatSession },
      "상담 상태 변경 응답을 확인할 수 없습니다.",
    );
  },

  assignSession: async (sessionId: number): Promise<ChatSession> => {
    const response = await assignSession(sessionId);
    return requireApiData<ChatSession>(
      response as unknown as { data?: ChatSession },
      "상담 배정 응답을 확인할 수 없습니다.",
    );
  },

  releaseSession: async (sessionId: number): Promise<ChatSession> => {
    const response = await releaseSession(sessionId);
    return requireApiData<ChatSession>(
      response as unknown as { data?: ChatSession },
      "상담 배정 해제 응답을 확인할 수 없습니다.",
    );
  },

  updateResponseMode: async (
    sessionId: number,
    counselorId: number,
    responseMode: ConsultationResponseMode,
  ): Promise<ChatSession> => {
    const response = await updateResponseMode(sessionId, { counselorId, responseMode });
    return requireApiData<ChatSession>(
      response as unknown as { data?: ChatSession },
      "AI 응대 모드 변경 응답을 확인할 수 없습니다.",
    );
  },

  getMetrics: async (
    workspaceId: number,
    params: ConsultationMetricsParams = {},
  ): Promise<ConsultationMetrics> => {
    const searchParams = new URLSearchParams();
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
    const query = searchParams.toString();
    const url = `/api/v1/workspaces/${workspaceId}/consultation/metrics${query ? `?${query}` : ""}`;
    const response = await customFetch<ConsultationMetrics | { data?: ConsultationMetrics }>(url, {
      method: "GET",
    });
    return requireApiData<ConsultationMetrics>(response, "상담 지표 응답을 확인할 수 없습니다.");
  },

  getWorkflowRankings: async (
    workspaceId: number,
    params: ConsultationMetricsParams = {},
  ): Promise<WorkspaceWorkflowRankingResponse> => {
    const searchParams = new URLSearchParams();
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
    const query = searchParams.toString();
    const url = `/api/v1/workspaces/${workspaceId}/dashboard/workflow-rankings${query ? `?${query}` : ""}`;
    const response = await customFetch<
      WorkspaceWorkflowRankingResponse | { data?: WorkspaceWorkflowRankingResponse }
    >(url, { method: "GET" });
    return requireApiData<WorkspaceWorkflowRankingResponse>(
      response,
      "워크플로우 랭킹 응답을 확인할 수 없습니다.",
    );
  },

  getWorkflowBottleneckAnalysis: async (
    workspaceId: number,
    workflowDefinitionId: number,
    params: ConsultationMetricsParams = {},
  ): Promise<WorkspaceWorkflowBottleneckAnalysis> => {
    const searchParams = new URLSearchParams();
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
    const query = searchParams.toString();
    const url = `/api/v1/workspaces/${workspaceId}/dashboard/workflows/${workflowDefinitionId}/bottleneck-analysis${query ? `?${query}` : ""}`;
    const response = await customFetch<
      WorkspaceWorkflowBottleneckAnalysis | { data?: WorkspaceWorkflowBottleneckAnalysis }
    >(url, { method: "GET" });
    return requireApiData<WorkspaceWorkflowBottleneckAnalysis>(
      response,
      "워크플로우 병목 분석 응답을 확인할 수 없습니다.",
    );
  },

  generateDraftResponse: async (sessionId: number): Promise<DraftResponse> => {
    const response = await generateDraftResponse(sessionId);
    return requireApiData<DraftResponse>(
      response as unknown as { data?: DraftResponse },
      "답변 초안 응답을 확인할 수 없습니다.",
    );
  },
};
