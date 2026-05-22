import { useQuery } from "@tanstack/react-query";
import { consultationApi } from "./consultationApi";
import { chatHistoryKeys } from "./chatHistoryKeys";

export interface UseChatSessionsParams {
  workspaceId: string;
  status?: string;
  page?: number;
  size?: number;
}

export function useChatSessions({ workspaceId, status, page = 0, size = 20 }: UseChatSessionsParams) {
  return useQuery({
    queryKey: chatHistoryKeys.sessionList(workspaceId, status, page, size),
    queryFn: () => consultationApi.getSessions({ status, page, size }),
  });
}

export function useChatMessages(sessionId: string, page: number = 0, size: number = 50) {
  return useQuery({
    queryKey: chatHistoryKeys.messages(sessionId, page, size),
    queryFn: () => consultationApi.getMessages(Number(sessionId), { page, size }),
    enabled: !!sessionId,
  });
}
