import { useQuery } from "@tanstack/react-query";
import { consultationApi } from "./consultationApi";
import { chatHistoryKeys } from "./chatHistoryKeys";

export interface UseChatSessionsParams {
  workspaceId: number | null;
  status?: string;
  page?: number;
  size?: number;
}

export function useChatSessions({
  workspaceId,
  status,
  page = 0,
  size = 20,
}: UseChatSessionsParams) {
  return useQuery({
    queryKey: chatHistoryKeys.sessionList(workspaceId, status, page, size),
    queryFn: () => {
      if (workspaceId === null) return [];
      return consultationApi.getSessions(workspaceId, { status, page, size });
    },
    enabled: workspaceId !== null,
  });
}

export function useChatMessages(sessionId: string, page: number = 0, size: number = 50) {
  const parsedSessionId = Number(sessionId);
  const hasValidSessionId = Number.isSafeInteger(parsedSessionId) && parsedSessionId > 0;

  return useQuery({
    queryKey: chatHistoryKeys.messages(sessionId, page, size),
    queryFn: () => consultationApi.getMessages(parsedSessionId, { page, size }),
    enabled: hasValidSessionId,
  });
}
