import { customFetch } from "@/shared/api/mutator";
import type { ChatMessage, ChatSession } from "@/entities/chat/model/types";

interface ChatMessageResponse {
  id: number;
  seqNo: number;
  senderRole: string;
  messageType: string;
  content: string;
  createdAt: string;
}

interface DemoChatWorkflowResponse {
  chatSession?: {
    id?: string;
    status?: string;
    startedAt?: string;
    completedAt?: string;
  };
  messages?: DemoMessageResponse[];
}

interface DemoMessageResponse {
  id?: string;
  role?: string;
  content?: string;
  timestamp?: string;
}

export interface DemoChatSession {
  id: string;
  status: string;
  startedAt: string;
  messages: ChatMessage[];
}

interface DemoRegisteredChatSessionResponse {
  id?: number;
  status?: string;
  channel?: string;
  metaJson?: string;
  startedAt?: string;
}

function requireBackendSessionId(id: number | undefined): number {
  if (typeof id !== "number" || !Number.isFinite(id)) {
    throw new Error("Demo chat session response is missing a numeric id.");
  }
  return id;
}

function toSenderType(senderRole: string): ChatMessage["senderType"] {
  if (senderRole === "USER" || senderRole === "CUSTOMER") return "USER";
  if (senderRole === "AGENT" || senderRole === "COUNSELOR") return "AGENT";
  return "BOT";
}

function toChatMessage(message: ChatMessageResponse, sessionId: number): ChatMessage {
  return {
    id: String(message.id),
    sessionId,
    content: message.content,
    senderType: toSenderType(message.senderRole),
    createdAt: message.createdAt,
  };
}

function toDemoSenderType(role?: string): ChatMessage["senderType"] {
  if (role === "user" || role === "customer") return "USER";
  if (role === "agent" || role === "counselor") return "AGENT";
  return "BOT";
}

function toDemoChatMessage(
  message: DemoMessageResponse,
  index: number,
  customerName: string,
): ChatMessage {
  const senderType = toDemoSenderType(message.role);
  return {
    id: message.id ?? `demo-message-${index}`,
    sessionId: 0,
    content: message.content ?? "",
    senderType,
    senderName: senderType === "USER" ? customerName : undefined,
    createdAt: message.timestamp ?? new Date().toISOString(),
  };
}

export function createChatSession(workspaceId: number, customerName: string): Promise<ChatSession> {
  const params = new URLSearchParams({ customerName });
  return customFetch<ChatSession>(
    `/api/v1/workspaces/${workspaceId}/chat/sessions/current?${params.toString()}`,
    {
      method: "GET",
    },
  );
}

export async function listChatMessages(sessionId: number): Promise<ChatMessage[]> {
  const messages = await customFetch<ChatMessageResponse[]>(
    `/api/v1/consultation/sessions/${sessionId}/messages`,
    { method: "GET" },
  );
  return messages.map((message) => toChatMessage(message, sessionId));
}

export async function createDemoChatSession(
  workspaceId: number,
  customerName: string,
): Promise<DemoChatSession> {
  const response = await customFetch<DemoChatWorkflowResponse>(
    `/api/v1/workspaces/${workspaceId}/demo/chat-workflow`,
    { method: "GET" },
  );
  const chatSession = response.chatSession;

  return {
    id: chatSession?.id ?? `workspace-${workspaceId}-demo-session`,
    status: chatSession?.status ?? "open",
    startedAt: chatSession?.startedAt ?? new Date().toISOString(),
    messages: (response.messages ?? []).map((message, index) =>
      toDemoChatMessage(message, index, customerName),
    ),
  };
}

export async function registerDemoChatSession(
  workspaceId: number,
  customerName: string,
): Promise<DemoChatSession> {
  const response = await customFetch<DemoRegisteredChatSessionResponse>(
    `/api/v1/workspaces/${workspaceId}/demo/chat-sessions`,
    {
      method: "POST",
      body: JSON.stringify({ customerName }),
    },
  );
  const sessionId = requireBackendSessionId(response.id);
  const startedAt = response.startedAt ?? new Date().toISOString();

  return {
    id: String(sessionId),
    status: response.status ?? "OPEN",
    startedAt,
    messages: [
      {
        id: `backend-greeting-${sessionId}`,
        sessionId,
        content: `안녕하세요, ${customerName}님. 무엇을 도와드릴까요?`,
        senderType: "BOT",
        createdAt: startedAt,
      },
    ],
  };
}

export async function sendDemoChatMessage(
  workspaceId: number,
  sessionId: string,
  content: string,
): Promise<ChatMessage[]> {
  const numericSessionId = Number(sessionId);
  if (!Number.isFinite(numericSessionId)) {
    throw new Error("Demo chat session id must be numeric.");
  }
  const messages = await customFetch<ChatMessageResponse[]>(
    `/api/v1/workspaces/${workspaceId}/demo/chat-sessions/${sessionId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    },
  );
  return messages.map((message) => toChatMessage(message, numericSessionId));
}

export async function listDemoChatMessages(
  workspaceId: number,
  sessionId: string,
): Promise<ChatMessage[]> {
  const numericSessionId = Number(sessionId);
  if (!Number.isFinite(numericSessionId)) {
    throw new Error("Demo chat session id must be numeric.");
  }
  const messages = await customFetch<ChatMessageResponse[]>(
    `/api/v1/workspaces/${workspaceId}/demo/chat-sessions/${sessionId}/messages`,
    { method: "GET" },
  );
  return messages.map((message) => toChatMessage(message, numericSessionId));
}
