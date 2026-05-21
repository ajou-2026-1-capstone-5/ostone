import {
  getMessages,
  getQueue,
  sendMessage,
  updateStatus,
} from "@/shared/api/generated/endpoints/consultation-controller/consultation-controller";
import type { ChatMessageResponse, ChatSessionResponse } from "@/shared/api/generated/zod";

export type ChatSession = ChatSessionResponse;
export type ChatMessage = ChatMessageResponse;

export const consultationApi = {
  getQueue: async (): Promise<ChatSession[]> => {
    return (await getQueue()).data;
  },

  getMessages: async (sessionId: number): Promise<ChatMessage[]> => {
    return (await getMessages(sessionId)).data;
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
