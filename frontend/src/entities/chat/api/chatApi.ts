import { customFetch } from "@/shared/api/mutator";
import type { ChatSession } from "@/entities/chat/model/types";

export function createChatSession(workspaceId: number): Promise<ChatSession> {
  return customFetch<ChatSession>("/api/v1/chat/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId }),
  });
}
