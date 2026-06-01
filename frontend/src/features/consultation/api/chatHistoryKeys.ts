import type { ChatSessionListParams } from "./consultationApi";

export const chatHistoryKeys = {
  all: ["chat-history"] as const,
  sessionList: (workspaceId: number | null, params: ChatSessionListParams) =>
    ["chat-history", "session-list", workspaceId, params] as const,
  messages: (sessionId: string, page?: number, size?: number) =>
    ["chat-history", "messages", sessionId, page ?? 0, size ?? 50] as const,
};
