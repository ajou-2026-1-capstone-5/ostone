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

export const consultationApi = {
  getQueue: async (): Promise<ChatSession[]> => {
    return (await getQueue()).data;
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
    return (await customFetch<{ data: ChatSession[]; status: number; headers: Headers }>(url, { method: "GET" })).data;
  },

  getMessages: async (
    sessionId: number,
    params?: { page?: number; size?: number },
  ): Promise<ChatMessage[]> => {
    if (!params) {
      return (await getMessages(sessionId)).data;
    }
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.size !== undefined) searchParams.set("size", String(params.size));
    const query = searchParams.toString();
    const url = `${getGetMessagesUrl(sessionId)}${query ? `?${query}` : ""}`;
    return (await customFetch<{ data: ChatMessage[]; status: number; headers: Headers }>(url, { method: "GET" })).data;
  },

  sendMessage: async (
    sessionId: number,
    content: string,
    isNote: boolean = false,
  ): Promise<ChatMessage> => {
    return (await sendMessage(sessionId, { content, isNote })).data;
  },

  updateStatus: async (sessionId: number, status: string): Promise<ChatSession> => {
    return (await updateStatus(sessionId, { status })).data;
  },
};
