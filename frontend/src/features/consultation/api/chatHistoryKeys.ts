export const chatHistoryKeys = {
  all: ["chat-history"] as const,
  sessionList: (workspaceId: number | null, status?: string, page?: number, size?: number) =>
    ["chat-history", "session-list", workspaceId, status ?? "all", page ?? 0, size ?? 20] as const,
  messages: (sessionId: string, page?: number, size?: number) =>
    ["chat-history", "messages", sessionId, page ?? 0, size ?? 50] as const,
};
