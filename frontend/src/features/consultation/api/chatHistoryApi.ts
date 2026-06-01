import { useQuery } from "@tanstack/react-query";
import { consultationApi, type ChatSessionListParams } from "./consultationApi";
import { chatHistoryKeys } from "./chatHistoryKeys";

export interface UseChatSessionsParams extends ChatSessionListParams {
  workspaceId: number | null;
}

export function useChatSessions({
  workspaceId,
  status,
  keyword,
  startedFrom,
  startedTo,
  assignedCounselorId,
  page = 0,
  size = 20,
}: UseChatSessionsParams) {
  const params = {
    status,
    keyword,
    startedFrom,
    startedTo,
    assignedCounselorId,
    page,
    size,
  };

  return useQuery({
    queryKey: chatHistoryKeys.sessionList(workspaceId, params),
    queryFn: () => {
      if (workspaceId === null) {
        return {
          content: [],
          page,
          size,
          totalElements: 0,
          totalPages: 0,
        };
      }
      return consultationApi.getSessionPage(workspaceId, params);
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

export function useChatMessagePage(sessionId: string, page: number = 0, size: number = 50) {
  const parsedSessionId = Number(sessionId);
  const hasValidSessionId = Number.isSafeInteger(parsedSessionId) && parsedSessionId > 0;

  return useQuery({
    queryKey: [...chatHistoryKeys.messages(sessionId, page, size), "page"] as const,
    queryFn: () => consultationApi.getMessagePage(parsedSessionId, { page, size }),
    enabled: hasValidSessionId,
  });
}
