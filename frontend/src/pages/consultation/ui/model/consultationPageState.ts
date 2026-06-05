import { ApiRequestError } from "@/shared/api";
import type { QueueCustomer } from "../../../../features/consultation/ui/QueuePanel";
import type {
  ChatComposerDraft,
  ChatMessage as UiChatMessage,
} from "../../../../features/consultation/ui/ChatPanel";
import {
  normalizeChatSenderRole,
  type ChatSenderRole,
} from "../../../../features/consultation/lib/chatRoleLabels";
import { formatWaitDuration } from "../../../../features/consultation/lib/formatWaitDuration";
import { sortMessagesByServerOrder } from "../../../../features/consultation/lib/messageOrder";
import type {
  ChatSession,
  ConsultationSessionStatus,
  ResolutionOutcome,
} from "../../../../features/consultation/api/consultationApi";

type CustomerPanelInfo = {
  membershipTier?: string | null;
  contact?: string | null;
  email?: string | null;
};

type CustomerOrderInfo = {
  orderNumber?: string | null;
  orderDate?: string | null;
  paymentAmount?: string | null;
  deliveryStatus?: string | null;
};

type CustomerExtractedInfo = {
  cardNumber?: string | null;
  refundAmount?: string | null;
  refundReason?: string | null;
  dueDate?: string | null;
};

export const COUNSELOR_MESSAGE_ACK_TIMEOUT_MS = 8000;
export const MESSAGE_PAGE_SIZE = 50;

const DEFAULT_RESPONSE_MODE = "AI_ACTIVE" as const;

export const EMPTY_COMPOSER_DRAFT: ChatComposerDraft = {
  input: "",
  isNoteMode: false,
};

export type RealtimeChatMessage = {
  id: string | number;
  seqNo?: number | null;
  senderRole: string;
  content?: string | null;
  createdAt?: string | null;
  timestamp?: string | null;
};

export type MessageLike = {
  id?: string | number | null;
  seqNo?: number | null;
  senderRole?: string | null;
  content?: string | null;
  createdAt?: string | null;
  timestamp?: string | null;
};

export type PendingMessage = {
  id: string;
  sessionId: string;
  content: string;
  isNote: boolean;
  timeoutId: ReturnType<typeof setTimeout>;
  createdAt: number;
};

type SessionMeta = {
  customerName?: string;
  membershipTier?: string;
  contact?: string;
  email?: string;
  customerInfo?: {
    membershipTier?: string | null;
    contact?: string | null;
    email?: string | null;
  };
  orderInfo?: CustomerOrderInfo | null;
  extractedInfo?: CustomerExtractedInfo | null;
  handoffRequired?: boolean;
  handoffReason?: string;
  handoffAt?: string;
  handoffNodeId?: string;
  title?: string;
  lastMessagePreview?: string;
  lastMessageRole?: string;
  lastMessageAt?: string;
};

type QueueCustomerPanelData = {
  customerInfo: CustomerPanelInfo;
  orderInfo: CustomerOrderInfo | null;
  extractedInfo: CustomerExtractedInfo | null;
};

export type QueueCustomerWithPanelData = QueueCustomer & QueueCustomerPanelData;

export type MessagePaginationState = {
  nextPage: number;
  totalPages: number;
  isLoadingPrevious: boolean;
};

export type EndSessionModalState =
  | { open: false }
  | {
      open: true;
      sessionId: string;
      customerName: string;
      outcome: ResolutionOutcome | null;
      reason: string;
      isSubmitting: boolean;
      error: string | null;
    };

export type ReleaseAssignmentModalState =
  | { open: false }
  | {
      open: true;
      sessionId: string;
      customerName: string;
      isSubmitting: boolean;
      error: string | null;
    };

export type ResolutionOutcomeOption = {
  value: ResolutionOutcome;
  label: string;
  description: string;
  status: Extract<ConsultationSessionStatus, "RESOLVED" | "COMPLETED">;
  followUpRequired: boolean;
};

export const RESOLUTION_OUTCOME_OPTIONS: ResolutionOutcomeOption[] = [
  {
    value: "RESOLVED",
    label: "해결됨",
    description: "문제가 해결되어 상담 기록을 해결 상태로 남깁니다.",
    status: "RESOLVED",
    followUpRequired: false,
  },
  {
    value: "CUSTOMER_LEFT",
    label: "고객 이탈",
    description: "고객 응답 없이 상담을 완전히 종료합니다.",
    status: "COMPLETED",
    followUpRequired: false,
  },
  {
    value: "PENDING",
    label: "보류",
    description: "현재 상담은 대기열에서 제거하고 후속 확인 대상으로 남깁니다.",
    status: "RESOLVED",
    followUpRequired: true,
  },
  {
    value: "FOLLOW_UP_REQUIRED",
    label: "후속 연락 필요",
    description: "상담 기록에 후속 연락 필요 여부를 명확히 남깁니다.",
    status: "RESOLVED",
    followUpRequired: true,
  },
];

export const findResolutionOutcomeOption = (outcome: ResolutionOutcome | null) =>
  RESOLUTION_OUTCOME_OPTIONS.find((option) => option.value === outcome) ?? null;

export const getComposerDraftReleaseWarning = (draft: ChatComposerDraft) => {
  if (!draft.input.trim()) return null;
  return draft.isNoteMode
    ? "메시지 입력창에 작성 중인 내부 메모가 있습니다."
    : "메시지 입력창에 작성 중인 답변이 있습니다.";
};

export const formatTime = (isoString: string) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};

export const toUiMessage = (message: MessageLike): UiChatMessage => {
  const rawCreatedAt = message.createdAt ?? message.timestamp ?? null;
  const displayCreatedAt = rawCreatedAt ?? new Date().toISOString();
  return {
    id: String(message.id ?? `message-${displayCreatedAt}-${message.content ?? ""}`),
    ...(message.seqNo != null ? { seqNo: message.seqNo } : {}),
    ...(rawCreatedAt != null ? { createdAt: rawCreatedAt } : {}),
    senderRole: normalizeChatSenderRole(message.senderRole),
    content: message.content ?? "",
    timestamp: formatTime(displayCreatedAt),
  };
};

export const mergeMessagesById = (
  currentMessages: UiChatMessage[],
  nextMessages: UiChatMessage[],
): UiChatMessage[] => {
  const byId = new Map<string, UiChatMessage>();
  [...currentMessages, ...nextMessages].forEach((message) => {
    byId.set(message.id, message);
  });
  return sortMessagesByServerOrder(Array.from(byId.values()));
};

export const shouldRefreshMatchedWorkflow = (role: ChatSenderRole) =>
  role === "ASSISTANT" || role === "SYSTEM";

export const isCounselorEchoRole = (role: ChatSenderRole) =>
  role === "COUNSELOR" || role === "AGENT" || role === "NOTE";

const pendingRoleMatchesEcho = (pending: PendingMessage, role: ChatSenderRole) =>
  pending.isNote ? role === "NOTE" : role === "COUNSELOR" || role === "AGENT";

const hasSendingMessage = (messages: UiChatMessage[], pendingId: string) =>
  messages.some((message) => message.id === pendingId && message.deliveryStatus === "sending");

const findPendingEchoMatch = (
  pendingMessages: Iterable<PendingMessage>,
  messages: UiChatMessage[],
  sessionId: string,
  role: ChatSenderRole,
  content: string,
) =>
  [...pendingMessages]
    .filter(
      (pending) =>
        pending.sessionId === sessionId &&
        pendingRoleMatchesEcho(pending, role) &&
        pending.content === content &&
        hasSendingMessage(messages, pending.id),
    )
    .sort((a, b) => a.createdAt - b.createdAt)[0];

export const reconcileCounselorEchoMessage = (
  messages: UiChatMessage[],
  pendingMessages: Map<string, PendingMessage>,
  sessionId: string,
  role: ChatSenderRole,
  realtimeMessage: RealtimeChatMessage,
) => {
  const serverMessage = {
    ...toUiMessage(realtimeMessage),
    deliveryStatus: "sent" as const,
  };
  if (messages.some((message) => message.id === serverMessage.id)) {
    return messages;
  }

  const pendingMatch = findPendingEchoMatch(
    pendingMessages.values(),
    messages,
    sessionId,
    role,
    realtimeMessage.content ?? "",
  );
  if (!pendingMatch) {
    return messages;
  }

  clearTimeout(pendingMatch.timeoutId);
  pendingMessages.delete(pendingMatch.id);
  return sortMessagesByServerOrder(
    messages.map((message) => (message.id === pendingMatch.id ? serverMessage : message)),
  );
};

export const markMessageSending = (messages: UiChatMessage[], messageId: string) =>
  messages.map((message) =>
    message.id === messageId
      ? {
          ...message,
          deliveryStatus: "sending" as const,
          retryable: false,
          errorMessage: undefined,
          timestamp: formatTime(new Date().toISOString()),
        }
      : message,
  );

const calcWaitMinutes = (isoString: string) => {
  if (!isoString) return 0;
  const d = new Date(isoString);
  const diffMs = new Date().getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
};

const formatLastMessageTimeLabel = (isoString?: string | null) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  const timestamp = d.getTime();
  if (Number.isNaN(timestamp)) return "";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  return diffMinutes === 0 ? "방금 전" : `${formatWaitDuration(diffMinutes)} 전`;
};

const parseSessionMeta = (metaJson?: string | null): SessionMeta => {
  try {
    if (!metaJson) return {};
    const meta = JSON.parse(metaJson) as SessionMeta;
    return meta && typeof meta === "object" ? meta : {};
  } catch (e) {
    console.error("Failed to parse metaJson", e);
    return {};
  }
};

const normalizePanelText = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized || undefined;
};

const buildCustomerPanelData = (meta: SessionMeta): QueueCustomerPanelData => ({
  customerInfo: {
    membershipTier: normalizePanelText(meta.customerInfo?.membershipTier ?? meta.membershipTier),
    contact: normalizePanelText(meta.customerInfo?.contact ?? meta.contact),
    email: normalizePanelText(meta.customerInfo?.email ?? meta.email),
  },
  orderInfo: meta.orderInfo ?? null,
  extractedInfo: meta.extractedInfo ?? null,
});

const getSessionStatusLabel = (
  status?: string | null,
  assignedCounselorId?: number | null,
  currentCounselorId?: number | null,
  handoffRequired?: boolean,
) => {
  const prefix = handoffRequired ? "상담사 연결 요청 · " : "";
  if (status === "COMPLETED") return "상담 종료";
  if (status === "RESOLVED") return "해결됨";
  if (assignedCounselorId && assignedCounselorId === currentCounselorId)
    return `${prefix}내게 배정됨`;
  if (assignedCounselorId) return `${prefix}다른 상담사 배정`;
  if (status === "ACTIVE") return `${prefix}미배정`;
  if (status === "OPEN") return `${prefix}미배정`;
  return status ?? "상태 미확인";
};

export type AssignmentView = {
  label: string;
  description: string;
};

export const getAssignmentView = (
  status?: string | null,
  assignedCounselorId?: number | null,
  currentCounselorId?: number | null,
): AssignmentView => {
  if (status === "COMPLETED" || status === "RESOLVED") {
    return {
      label: status === "RESOLVED" ? "해결됨" : "상담 종료",
      description: "종료된 세션이므로 메시지를 보낼 수 없습니다.",
    };
  }

  if (assignedCounselorId && assignedCounselorId === currentCounselorId) {
    return {
      label: "내게 배정됨",
      description: "이 세션에 응답하고 내부 메모를 남길 수 있습니다.",
    };
  }

  if (assignedCounselorId) {
    return {
      label: "다른 상담사 배정",
      description: "다른 상담사가 응대 중인 세션이므로 메시지를 보낼 수 없습니다.",
    };
  }

  return {
    label: "미배정",
    description: "배정받기 전에는 메시지와 내부 메모를 보낼 수 없습니다.",
  };
};

export const getResponseStatusLabel = (
  status?: string | null,
  assignedCounselorId?: number | null,
) => {
  if (status === "COMPLETED") return "상담 종료";
  if (status === "RESOLVED") return "해결됨";
  return assignedCounselorId ? "상담사 응대중" : "AI 응대";
};

export const isCustomerMessageRole = (role?: string | null) => {
  const normalizedRole = normalizeChatSenderRole(role);
  return normalizedRole === "USER" || normalizedRole === "CUSTOMER";
};

const getQueueSortTime = (customer: QueueCustomer) => {
  const timeSource =
    customer.handoffRequired && customer.handoffAt
      ? customer.handoffAt
      : (customer.lastMessageAt ?? customer.startedAt);
  if (!timeSource) return 0;
  const timestamp = new Date(timeSource).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const toQueueCustomer = (
  session: ChatSession,
  currentCounselorId: number | null,
  previous?: QueueCustomerWithPanelData,
  options?: { hasUnread?: boolean },
): QueueCustomerWithPanelData => {
  const meta = parseSessionMeta(session.metaJson);
  const panelData = buildCustomerPanelData(meta);
  const hasSessionMetaJson = session.metaJson !== undefined && session.metaJson !== null;
  const assignedCounselorId =
    session.assignedCounselorId !== undefined
      ? session.assignedCounselorId
      : (previous?.assignedCounselorId ?? null);
  const responseMode =
    session.responseMode ??
    previous?.responseMode ??
    (assignedCounselorId ? "HUMAN_ACTIVE" : DEFAULT_RESPONSE_MODE);
  const status = session.status !== undefined ? session.status : (previous?.status ?? null);
  const startedAt = session.startedAt ?? previous?.startedAt ?? null;
  const lastMessagePreview = meta.lastMessagePreview?.trim() || previous?.lastMessagePreview || "";
  const lastMessageRole = meta.lastMessageRole ?? previous?.lastMessageRole;
  const lastMessageAt = meta.lastMessageAt ?? previous?.lastMessageAt ?? null;
  const handoffRequired = meta.handoffRequired ?? previous?.handoffRequired ?? false;
  const handoffAt = meta.handoffAt ?? previous?.handoffAt ?? null;
  const handoffNodeId = meta.handoffNodeId ?? previous?.handoffNodeId ?? null;
  const lastMessageTimeLabel =
    formatLastMessageTimeLabel(lastMessageAt) || previous?.lastMessageTimeLabel;

  return {
    id: String(session.id ?? previous?.id ?? ""),
    name: meta.customerName?.trim() || previous?.name || "Unknown",
    title: meta.title?.trim() || previous?.title || "",
    channel: session.channel ?? previous?.channel ?? "",
    handoffReason: meta.handoffReason ?? previous?.handoffReason ?? "",
    handoffRequired,
    handoffAt,
    handoffNodeId,
    waitMinutes: startedAt ? calcWaitMinutes(startedAt) : (previous?.waitMinutes ?? 0),
    hasUnread: options?.hasUnread ?? previous?.hasUnread ?? false,
    lastMessagePreview,
    lastMessageRole,
    lastMessageAt,
    lastMessageTimeLabel,
    status,
    statusLabel: getSessionStatusLabel(
      status,
      assignedCounselorId,
      currentCounselorId,
      handoffRequired,
    ),
    assignedCounselorId,
    responseMode,
    startedAt,
    customerInfo: {
      membershipTier: hasSessionMetaJson
        ? panelData.customerInfo.membershipTier
        : previous?.customerInfo.membershipTier,
      contact: hasSessionMetaJson ? panelData.customerInfo.contact : previous?.customerInfo.contact,
      email: hasSessionMetaJson ? panelData.customerInfo.email : previous?.customerInfo.email,
    },
    orderInfo: hasSessionMetaJson ? panelData.orderInfo : (previous?.orderInfo ?? null),
    extractedInfo: hasSessionMetaJson ? panelData.extractedInfo : (previous?.extractedInfo ?? null),
  };
};

export const sortQueueCustomers = (customers: QueueCustomerWithPanelData[]) =>
  [...customers].sort((a, b) => {
    const aIsHandoff = a.handoffRequired === true;
    const bIsHandoff = b.handoffRequired === true;
    if (aIsHandoff !== bIsHandoff) {
      return aIsHandoff ? -1 : 1;
    }
    if (aIsHandoff && bIsHandoff) {
      return getQueueSortTime(a) - getQueueSortTime(b);
    }
    return getQueueSortTime(b) - getQueueSortTime(a);
  });

export const replaceAssignedQueueCustomer = (
  customers: QueueCustomerWithPanelData[],
  sessionId: string,
  assignedSession: ChatSession,
  currentCounselorId: number,
) =>
  sortQueueCustomers(
    customers.map((customer) =>
      customer.id === sessionId
        ? toQueueCustomer(assignedSession, currentCounselorId, customer)
        : customer,
    ),
  );

export const getClaimSessionErrorMessage = (error: unknown) => {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case "SESSION_ALREADY_ASSIGNED":
        return "이미 다른 상담사에게 배정된 상담입니다.";
      case "SESSION_NOT_ASSIGNABLE":
        return "현재 배정할 수 없는 상담 상태입니다.";
      case "SESSION_NOT_FOUND":
        return "상담 세션을 찾을 수 없습니다.";
      case "WORKSPACE_ACCESS_DENIED":
      case "FORBIDDEN":
        return "상담 배정 권한이 없습니다.";
      default:
        return "상담 세션 배정에 실패했습니다.";
    }
  }
  return "상담 세션 배정에 실패했습니다.";
};

export const dedupePrependMessages = (
  olderMessages: UiChatMessage[],
  currentMessages: UiChatMessage[],
) => {
  const existingIds = new Set(currentMessages.map((message) => message.id));
  return [...olderMessages.filter((message) => !existingIds.has(message.id)), ...currentMessages];
};

export type MetricsViewState = "loading" | "error" | "empty" | "ready";
