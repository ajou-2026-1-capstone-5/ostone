import {
  getMessages,
  getQueue,
  sendMessage,
  updateStatus,
  getGetMessagesUrl,
} from "@/shared/api/generated/endpoints/consultation-controller/consultation-controller";
import { customFetch } from "@/shared/api/mutator";
import type { ChatMessageResponse, ChatSessionResponse } from "@/shared/api/generated/zod";

export type ChatSession = ChatSessionResponse;
export type ChatMessage = ChatMessageResponse;

function unwrapData<T>(response: T | { data: T }): T {
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data: T }).data;
  }
  return response as T;
}

export const consultationApi = {
  getQueue: async (): Promise<ChatSession[]> => {
    return unwrapData(await getQueue());
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
    return unwrapData(
      await customFetch<ChatSession[] | { data: ChatSession[]; status: number; headers: Headers }>(
        url,
        { method: "GET" },
      ),
    );
  },

  getMessages: async (
    sessionId: number,
    params?: { page?: number; size?: number },
  ): Promise<ChatMessage[]> => {
    if (!params) {
      return unwrapData(await getMessages(sessionId));
    }
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.size !== undefined) searchParams.set("size", String(params.size));
    const query = searchParams.toString();
    const url = `${getGetMessagesUrl(sessionId)}${query ? `?${query}` : ""}`;
    return unwrapData(
      await customFetch<ChatMessage[] | { data: ChatMessage[]; status: number; headers: Headers }>(
        url,
        { method: "GET" },
      ),
    );
  },

  sendMessage: async (
    sessionId: number,
    content: string,
    isNote: boolean = false,
  ): Promise<ChatMessage> => {
    return unwrapData(await sendMessage(sessionId, { content, isNote }));
  },

  updateStatus: async (sessionId: number, status: string): Promise<ChatSession> => {
    return unwrapData(await updateStatus(sessionId, { status }));
  },
};
