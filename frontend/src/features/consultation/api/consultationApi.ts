import {
  getMessages,
  sendMessage,
  updateStatus,
  getGetMessagesUrl,
} from "@/shared/api/generated/endpoints/consultation-controller/consultation-controller";
import { customFetch } from "@/shared/api/mutator";
import { requireApiData, selectApiData } from "@/shared/api";
import type { ChatMessageResponse, ChatSessionResponse } from "@/shared/api/generated/zod";

// OpenAPI 미생성 endpoint: workspace-scoped queue/metrics/sessions list,
// assign/release, draft-response는 수동 호출로 유지한다.

export type ChatSession = Omit<ChatSessionResponse, 'responseMode'> & {
  assignedCounselorId?: number | null;
  responseMode?: ConsultationResponseMode | null;
};
export type ChatMessage = ChatMessageResponse;
export interface ChatMessagePage {
  content: ChatMessage[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export type ConsultationSessionStatus = "OPEN" | "ACTIVE" | "RESOLVED" | "COMPLETED";
export type ConsultationResponseMode = "AI_ACTIVE" | "HUMAN_ACTIVE" | "AI_ASSIST_ONLY";
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
  averageFirstResponseSeconds: number | null;
  averageLlmFirstResponseSeconds: number | null;
  averageHumanFirstResponseSeconds: number | null;
  handledTodayCount: number;
  llmHandledTodayCount: number;
  humanHandledTodayCount: number;
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

async function fetchMessagePage(
  sessionId: number,
  params: { page?: number; size?: number } = {},
): Promise<ChatMessagePage> {
  const page = normalizeMessagePage(params.page);
  const size = normalizeMessagePageSize(params.size);
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("size", String(size));
  const url = `${getGetMessagesUrl(sessionId)}?${searchParams.toString()}`;
  const response = await customFetch<MessageListResponse>(url, { method: "GET" });
  return unwrapMessagePage(response, { page, size });
}

export const consultationApi = {
  getQueue: async (workspaceId: number): Promise<ChatSession[]> => {
    const response = await customFetch<ChatSession[] | { data?: ChatSession[] }>(
      `/api/v1/workspaces/${workspaceId}/consultation/queue`,
      { method: "GET" },
    );
    return selectApiData<ChatSession[]>(response) ?? [];
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
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.keyword) searchParams.set("keyword", params.keyword);
    if (params?.startedFrom) searchParams.set("startedFrom", params.startedFrom);
    if (params?.startedTo) searchParams.set("startedTo", params.startedTo);
    if (params?.assignedCounselorId !== undefined) {
      searchParams.set("assignedCounselorId", String(params.assignedCounselorId));
    }
    if (params?.page !== undefined) searchParams.set("page", String(params.page));
    if (params?.size !== undefined) searchParams.set("size", String(params.size));
    const query = searchParams.toString();
    const url = `/api/v1/workspaces/${workspaceId}/consultation/sessions${query ? `?${query}` : ""}`;
    const response = await customFetch<SessionListResponse>(url, { method: "GET" });
    return unwrapSessionPage(response);
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
    const response = await customFetch<ChatSession | { data?: ChatSession }>(
      `/api/v1/consultation/sessions/${sessionId}/assign`,
      { method: "POST" },
    );
    return requireApiData<ChatSession>(response, "상담 배정 응답을 확인할 수 없습니다.");
  },

  releaseSession: async (sessionId: number): Promise<ChatSession> => {
    const response = await customFetch<ChatSession | { data?: ChatSession }>(
      `/api/v1/consultation/sessions/${sessionId}/release`,
      { method: "POST" },
    );
    return requireApiData<ChatSession>(response, "상담 배정 해제 응답을 확인할 수 없습니다.");
  },

  updateResponseMode: async (
    sessionId: number,
    counselorId: number,
    responseMode: ConsultationResponseMode,
  ): Promise<ChatSession> => {
    // OpenAPI generated endpoint is not available yet; replace this with generated API after api:gen exposes it.
    const response = await customFetch<ChatSession | { data?: ChatSession }>(
      `/api/v1/consultation/sessions/${sessionId}/response-mode`,
      {
        method: "PATCH",
        body: JSON.stringify({ counselorId, responseMode }),
      },
    );
    return requireApiData<ChatSession>(response, "AI 응대 모드 변경 응답을 확인할 수 없습니다.");
  },

  getMetrics: async (workspaceId: number): Promise<ConsultationMetrics> => {
    const response = await customFetch<ConsultationMetrics | { data?: ConsultationMetrics }>(
      `/api/v1/workspaces/${workspaceId}/consultation/metrics`,
      { method: "GET" },
    );
    return requireApiData<ConsultationMetrics>(response, "상담 지표 응답을 확인할 수 없습니다.");
  },

  generateDraftResponse: async (sessionId: number): Promise<DraftResponse> => {
    const response = await customFetch<DraftResponse | { data?: DraftResponse }>(
      `/api/v1/consultation/sessions/${sessionId}/draft-response`,
      { method: "POST" },
    );
    return requireApiData<DraftResponse>(response, "답변 초안 응답을 확인할 수 없습니다.");
  },
};
