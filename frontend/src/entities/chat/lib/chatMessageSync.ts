import type { ChatMessage } from "../model/types";

const DEMO_SESSION_ID_PATTERN = /^\d+$/;

export interface ChatMessageResponse {
  id?: number;
  seqNo?: number;
  senderRole?: string;
  messageType?: string;
  content?: string;
  createdAt?: string;
}

export interface RealtimeChatMessage {
  id: number | string;
  seqNo?: number;
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
  const hasKnownField =
    candidate.id !== undefined ||
    candidate.seqNo !== undefined ||
    candidate.senderRole !== undefined ||
    candidate.messageType !== undefined ||
    candidate.content !== undefined ||
    candidate.createdAt !== undefined;

  return (
    hasKnownField &&
    (candidate.id === undefined || typeof candidate.id === "number") &&
    (candidate.seqNo === undefined || typeof candidate.seqNo === "number") &&
    (candidate.senderRole === undefined || typeof candidate.senderRole === "string") &&
    (candidate.messageType === undefined || typeof candidate.messageType === "string") &&
    (candidate.content === undefined || typeof candidate.content === "string") &&
    (candidate.createdAt === undefined || typeof candidate.createdAt === "string")
  );
}

export function isRealtimeChatMessage(message: unknown): message is RealtimeChatMessage {
  if (!message || typeof message !== "object") return false;

  const candidate = message as Partial<RealtimeChatMessage>;
  return (
    (typeof candidate.id === "number" || typeof candidate.id === "string") &&
    (candidate.seqNo === undefined || typeof candidate.seqNo === "number") &&
    typeof candidate.senderRole === "string" &&
    typeof candidate.content === "string" &&
    typeof candidate.createdAt === "string"
  );
}

export function toSenderType(senderRole: string): ChatMessage["senderType"] {
  const normalizedRole = senderRole.toUpperCase();
  if (normalizedRole === "USER" || normalizedRole === "CUSTOMER") return "USER";
  if (normalizedRole === "AGENT" || normalizedRole === "COUNSELOR") return "AGENT";
  if (normalizedRole === "SYSTEM") return "SYSTEM";
  return "BOT";
}

export function toChatMessage(message: ChatMessageResponse, sessionId: number): ChatMessage {
  const stableCreatedAt = message.createdAt ?? "1970-01-01T00:00:00.000Z";
  const stableFallbackId =
    message.seqNo != null
      ? `srv-${sessionId}-seq-${message.seqNo}`
      : `srv-${sessionId}-${stableCreatedAt}-${message.senderRole ?? "BOT"}-${message.content ?? ""}`;

  return {
    id: String(message.id ?? stableFallbackId),
    sessionId,
    content: message.content ?? "",
    senderType: toSenderType(message.senderRole ?? "BOT"),
    ...(message.seqNo != null ? { seqNo: message.seqNo } : {}),
    createdAt: stableCreatedAt,
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
    ...(message.seqNo != null ? { seqNo: message.seqNo } : {}),
    createdAt: message.createdAt,
  };
}

// seqNo가 없는 메시지(optimistic/local 등)는 seqNo가 있는 서버 확정 메시지 뒤로 보낸다.
const SEQ_NO_FALLBACK = Number.POSITIVE_INFINITY;

function toComparableTime(createdAt: string): number {
  const time = new Date(createdAt).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

/**
 * 두 메시지의 서버 순서를 비교한다. 서버가 확정한 `seqNo`를 1순위로, 없으면
 * `createdAt`을 2순위로 사용한다. 0을 반환하면(같은 `seqNo`/같은 시각, 또는
 * 둘 다 없는 optimistic 메시지) 순서를 구분할 수 없으므로 호출 측에서 원래
 * 순서를 안정 tie-breaker로 사용해야 한다. 이렇게 하면 WebSocket 이벤트가
 * 역순으로 도착하거나 거의 동시에 도착해도 화면 순서가 뒤바뀌지 않는다.
 */
export function compareMessageOrder(a: ChatMessage, b: ChatMessage): number {
  const seqA = a.seqNo ?? SEQ_NO_FALLBACK;
  const seqB = b.seqNo ?? SEQ_NO_FALLBACK;
  if (seqA !== seqB) return seqA - seqB;

  const timeA = toComparableTime(a.createdAt);
  const timeB = toComparableTime(b.createdAt);
  if (timeA !== timeB) return timeA - timeB;

  return 0;
}

export function mergeMessages(
  currentMessages: ChatMessage[],
  nextMessages: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  [...currentMessages, ...nextMessages].forEach((message) => {
    byId.set(message.id, message);
  });
  // `seqNo`/`createdAt`으로 구분되지 않는 메시지는 원래(병합) 순서를 유지하도록
  // 원본 인덱스를 명시적 tie-breaker로 사용한다(Array.sort 안정성에 의존하지 않음).
  return Array.from(byId.values())
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      const byServerOrder = compareMessageOrder(a.message, b.message);
      return byServerOrder !== 0 ? byServerOrder : a.index - b.index;
    })
    .map(({ message }) => message);
}

export function withCustomerNames(messages: ChatMessage[], customerName: string): ChatMessage[] {
  return messages.map((message) =>
    message.senderType === "USER" ? { ...message, senderName: customerName } : message,
  );
}
