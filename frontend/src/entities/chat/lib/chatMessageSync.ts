import type { ChatMessage } from "../model/types";

const DEMO_SESSION_ID_PATTERN = /^\d+$/;

export interface ChatMessageResponse {
  id: number;
  seqNo: number;
  senderRole: string;
  messageType: string;
  content: string;
  createdAt: string;
}

export interface RealtimeChatMessage {
  id: number | string;
  senderRole: string;
  content: string;
  createdAt: string;
}

export function parseDemoSessionId(sessionId: string): number {
  const normalizedSessionId = sessionId.trim();
  if (!DEMO_SESSION_ID_PATTERN.test(normalizedSessionId)) {
    throw new Error("Demo chat session id must be numeric.");
  }

  const numericSessionId = Number(normalizedSessionId);
  if (!Number.isSafeInteger(numericSessionId)) {
    throw new Error("Demo chat session id must be numeric.");
  }

  return numericSessionId;
}

export function tryParseDemoSessionId(sessionId: string): number | null {
  try {
    return parseDemoSessionId(sessionId);
  } catch {
    return null;
  }
}

export function isChatMessageResponse(message: unknown): message is ChatMessageResponse {
  if (!message || typeof message !== "object") return false;

  const candidate = message as Partial<ChatMessageResponse>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.seqNo === "number" &&
    typeof candidate.senderRole === "string" &&
    typeof candidate.messageType === "string" &&
    typeof candidate.content === "string" &&
    typeof candidate.createdAt === "string"
  );
}

export function isRealtimeChatMessage(message: unknown): message is RealtimeChatMessage {
  if (!message || typeof message !== "object") return false;

  const candidate = message as Partial<RealtimeChatMessage>;
  return (
    (typeof candidate.id === "number" || typeof candidate.id === "string") &&
    typeof candidate.senderRole === "string" &&
    typeof candidate.content === "string" &&
    typeof candidate.createdAt === "string"
  );
}

export function toSenderType(senderRole: string): ChatMessage["senderType"] {
  const normalizedRole = senderRole.toUpperCase();
  if (normalizedRole === "USER" || normalizedRole === "CUSTOMER") return "USER";
  if (normalizedRole === "AGENT" || normalizedRole === "COUNSELOR") return "AGENT";
  return "BOT";
}

export function toChatMessage(message: ChatMessageResponse, sessionId: number): ChatMessage {
  return {
    id: String(message.id),
    sessionId,
    content: message.content,
    senderType: toSenderType(message.senderRole),
    createdAt: message.createdAt,
  };
}

export function toRealtimeChatMessage(
  message: RealtimeChatMessage,
  sessionId: number,
  customerName?: string,
): ChatMessage {
  const senderType = toSenderType(message.senderRole);
  return {
    id: String(message.id),
    sessionId,
    content: message.content,
    senderType,
    ...(senderType === "USER" ? { senderName: customerName } : {}),
    createdAt: message.createdAt,
  };
}

export function compareMessageCreatedAt(a: ChatMessage, b: ChatMessage): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function mergeMessages(
  currentMessages: ChatMessage[],
  nextMessages: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  [...currentMessages, ...nextMessages].forEach((message) => {
    byId.set(message.id, message);
  });
  return Array.from(byId.values()).sort(compareMessageCreatedAt);
}

export function withCustomerNames(messages: ChatMessage[], customerName: string): ChatMessage[] {
  return messages.map((message) =>
    message.senderType === "USER" ? { ...message, senderName: customerName } : message,
  );
}

export function mergePersistedMessages(
  currentMessages: ChatMessage[],
  persistedMessages: ChatMessage[],
): ChatMessage[] {
  const optimisticMessages = currentMessages.filter((message) => message.id.startsWith("local-"));
  return mergeMessages(optimisticMessages, persistedMessages);
}
