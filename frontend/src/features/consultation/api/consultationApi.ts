import {
  getMessages,
  sendMessage,
  updateStatus,
  getGetMessagesUrl,
} from "@/shared/api/generated/endpoints/consultation-controller/consultation-controller";
import { customFetch } from "@/shared/api/mutator";
import { unwrapApiResponse } from "@/shared/api/unwrapApiResponse";
import type { ChatMessageResponse, ChatSessionResponse } from "@/shared/api/generated/zod";

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

type SessionListResponse =
  | ChatSession[]
  | { data?: ChatSession[] | { content?: ChatSession[] }; content?: ChatSession[] };

type MessageListResponse =
  | ChatMessage[]
  | { data?: ChatMessage[] | { content?: ChatMessage[] }; content?: ChatMessage[] };

function unwrapSessionList(response: SessionListResponse): ChatSession[] {
  const unwrapped = unwrapApiResponse<ChatSession[] | { content?: ChatSession[] }>(response);
  if (Array.isArray(unwrapped)) return unwrapped;
  return unwrapped?.content ?? [];
}

function unwrapMessageList(response: MessageListResponse): ChatMessage[] {
  const unwrapped = unwrapApiResponse<ChatMessage[] | { content?: ChatMessage[] }>(response);
  if (Array.isArray(unwrapped)) return unwrapped;
  return unwrapped?.content ?? [];
}

export const consultationApi = {
  getQueue: async (workspaceId: number): Promise<ChatSession[]> => {
    const response = await customFetch<ChatSession[] | { data?: ChatSession[] }>(
      `/api/v1/workspaces/${workspaceId}/consultation/queue`,
      { method: "GET" },
    );
    return unwrapApiResponse<ChatSession[]>(response) ?? [];
  },

  getSessions: async (params?: {
    status?: string;
    page?: number;
    size?: number;
  }): Promise<ChatSession[]> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.page !== undefined) searchParams.set("page", String(params.page));
    if (params?.size !== undefined) searchParams.set("size", String(params.size));
    const query = searchParams.toString();
    const url = `/api/v1/consultation/sessions${query ? `?${query}` : ""}`;
    const response = await customFetch<SessionListResponse>(url, { method: "GET" });
    return unwrapSessionList(response);
  },

  getMessages: async (
    sessionId: number,
    params?: { page?: number; size?: number },
  ): Promise<ChatMessage[]> => {
    if (!params) {
      return unwrapApiResponse<ChatMessage[]>(await getMessages(sessionId)) ?? [];
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
    return unwrapApiResponse<ChatMessage>(await sendMessage(sessionId, { content, isNote }));
  },

  updateStatus: async (sessionId: number, status: string): Promise<ChatSession> => {
    return unwrapApiResponse<ChatSession>(await updateStatus(sessionId, { status }));
  },

  assignSession: async (sessionId: number, counselorId: number): Promise<ChatSession> => {
    const response = await customFetch<ChatSession | { data?: ChatSession }>(
      `/api/v1/consultation/sessions/${sessionId}/assign?counselorId=${counselorId}`,
      { method: "POST" },
    );
    return unwrapApiResponse<ChatSession>(response);
  },

  releaseSession: async (sessionId: number, counselorId: number): Promise<ChatSession> => {
    const response = await customFetch<ChatSession | { data?: ChatSession }>(
      `/api/v1/consultation/sessions/${sessionId}/release?counselorId=${counselorId}`,
      { method: "POST" },
    );
    return unwrapApiResponse<ChatSession>(response);
  },
};
