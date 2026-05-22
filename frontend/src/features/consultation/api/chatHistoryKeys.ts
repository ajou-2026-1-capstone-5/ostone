export const chatHistoryKeys = {
  all: ["chat-history"] as const,
  sessionList: (workspaceId: string, status?: string, page?: number) =>
    ["chat-history", "session-list", workspaceId, status ?? "all", page ?? 0] as const,
  messages: (sessionId: string, page?: number) =>
    ["chat-history", "messages", sessionId, page ?? 0] as const,
};
