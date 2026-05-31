import {
  getMessages,
  sendMessage,
  updateStatus,
  getGetMessagesUrl,
} from "@/shared/api/generated/endpoints/consultation-controller/consultation-controller";
import { customFetch } from "@/shared/api/mutator";
import { requireApiData, selectApiData } from "@/shared/api";
import type { ChatMessageResponse, ChatSessionResponse } from "@/shared/api/generated/zod";

// OpenAPI 미생성 endpoint: workspace-scoped queue/metrics/sessions list, assign/release는 수동 호출로 유지한다.

export type ChatSession = ChatSessionResponse & {
  assignedCounselorId?: number | null;
};
export type ChatMessage = ChatMessageResponse;
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

type SessionListResponse =
  | ChatSession[]
  | { data?: ChatSession[] | { content?: ChatSession[] }; content?: ChatSession[] };

type MessageListResponse =
  | ChatMessage[]
  | { data?: ChatMessage[] | { content?: ChatMessage[] }; content?: ChatMessage[] };

function unwrapSessionList(response: SessionListResponse): ChatSession[] {
  const unwrapped = selectApiData<ChatSession[] | { content?: ChatSession[] }>(response);
  if (Array.isArray(unwrapped)) return unwrapped;
  return unwrapped?.content ?? [];
}

function unwrapMessageList(response: MessageListResponse): ChatMessage[] {
  const unwrapped = selectApiData<ChatMessage[] | { content?: ChatMessage[] }>(response);
  if (Array.isArray(unwrapped)) return unwrapped;
  return unwrapped?.content ?? [];
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
    params?: {
      status?: string;
      page?: number;
      size?: number;
    },
  ): Promise<ChatSession[]> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.page !== undefined) searchParams.set("page", String(params.page));
    if (params?.size !== undefined) searchParams.set("size", String(params.size));
    const query = searchParams.toString();
    const url = `/api/v1/workspaces/${workspaceId}/consultation/sessions${query ? `?${query}` : ""}`;
    const response = await customFetch<SessionListResponse>(url, { method: "GET" });
    return unwrapSessionList(response);
  },

  getMessages: async (
    sessionId: number,
    params?: { page?: number; size?: number },
  ): Promise<ChatMessage[]> => {
    if (!params) {
      return selectApiData<ChatMessage[]>(await getMessages(sessionId)) ?? [];
    }
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.size !== undefined) searchParams.set("size", String(params.size));
    const query = searchParams.toString();
    const url = `${getGetMessagesUrl(sessionId)}${query ? `?${query}` : ""}`;
    const response = await customFetch<MessageListResponse>(url, { method: "GET" });
    return unwrapMessageList(response);
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

  updateStatus: async (sessionId: number, status: string): Promise<ChatSession> => {
    return requireApiData<ChatSession>(
      await updateStatus(sessionId, { status }),
      "상담 상태 변경 응답을 확인할 수 없습니다.",
    );
  },

  assignSession: async (sessionId: number, counselorId: number): Promise<ChatSession> => {
    const response = await customFetch<ChatSession | { data?: ChatSession }>(
      `/api/v1/consultation/sessions/${sessionId}/assign?counselorId=${counselorId}`,
      { method: "POST" },
    );
    return requireApiData<ChatSession>(response, "상담 배정 응답을 확인할 수 없습니다.");
  },

  releaseSession: async (sessionId: number, counselorId: number): Promise<ChatSession> => {
    const response = await customFetch<ChatSession | { data?: ChatSession }>(
      `/api/v1/consultation/sessions/${sessionId}/release?counselorId=${counselorId}`,
      { method: "POST" },
    );
    return requireApiData<ChatSession>(response, "상담 배정 해제 응답을 확인할 수 없습니다.");
  },

  getMetrics: async (workspaceId: number): Promise<ConsultationMetrics> => {
    const response = await customFetch<ConsultationMetrics | { data?: ConsultationMetrics }>(
      `/api/v1/workspaces/${workspaceId}/consultation/metrics`,
      { method: "GET" },
    );
    return requireApiData<ConsultationMetrics>(response, "상담 지표 응답을 확인할 수 없습니다.");
  },
};
