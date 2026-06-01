import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ApiRequestError } from "@/shared/api";
import type { ShellContext } from "@/shared/ui/ostone/chrome";
import { Dot, Mono, Avatar } from "@/shared/ui/ostone/atoms";
import { useStomp, type ConnectionStatus } from "@/shared/lib/websocket";
import { getAuthUser } from "@/shared/lib/auth";
import { QueuePanel } from "../../../features/consultation/ui/QueuePanel";
import type { QueueCustomer } from "../../../features/consultation/ui/QueuePanel";
import { ChatPanel } from "../../../features/consultation/ui/ChatPanel";
import type {
  ChatComposerDraft,
  ChatMessage as UiChatMessage,
} from "../../../features/consultation/ui/ChatPanel";
import {
  normalizeChatSenderRole,
  type ChatSenderRole,
} from "../../../features/consultation/lib/chatRoleLabels";
import { formatWaitDuration } from "../../../features/consultation/lib/formatWaitDuration";
import { consultationApi } from "../../../features/consultation/api/consultationApi";
import type {
  ChatSession,
  ConsultationSessionStatus,
  ConsultationResponseMode,
  ConsultationMetrics,
  ConsultationQueueEvent,
  ResolutionOutcome,
} from "../../../features/consultation/api/consultationApi";
import {
  CustomerPanel,
  type CustomerExtractedInfo,
  type CustomerInfo,
  type CustomerOrderInfo,
} from "./sections/CustomerPanel";
import { MatchedWorkflowBar, MatchedWorkflowBarSkeleton } from "./sections/MatchedWorkflowBar";
import { MessageDetailPanel } from "../../../features/consultation/ui/MessageDetailPanel";
import {
  getCurrentWorkflow,
  type MatchedWorkflow,
} from "../../../features/consultation/api/llmToolWorkflowApi";
import styles from "./consultation-page.module.css";

const formatTime = (isoString: string) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};

type RealtimeChatMessage = {
  id: string | number;
  senderRole: string;
  content?: string | null;
  createdAt?: string | null;
  timestamp?: string | null;
};

type MessageLike = {
  id?: string | number | null;
  senderRole?: string | null;
  content?: string | null;
  createdAt?: string | null;
  timestamp?: string | null;
};

type PendingMessage = {
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
  customerInfo: Pick<CustomerInfo, "membershipTier" | "contact" | "email">;
  orderInfo: CustomerOrderInfo | null;
  extractedInfo: CustomerExtractedInfo | null;
};

type QueueCustomerWithPanelData = QueueCustomer & QueueCustomerPanelData;

const COUNSELOR_MESSAGE_ACK_TIMEOUT_MS = 8000;
const MESSAGE_PAGE_SIZE = 50;

type MessagePaginationState = {
  nextPage: number;
  totalPages: number;
  isLoadingPrevious: boolean;
};

type ResponseModeView = {
  value: ConsultationResponseMode;
  label: string;
  description: string;
};

const RESPONSE_MODE_OPTIONS: ResponseModeView[] = [
  {
    value: "AI_ACTIVE",
    label: "AI 응대중",
    description: "고객 메시지에 AI가 자동응답합니다.",
  },
  {
    value: "HUMAN_ACTIVE",
    label: "상담사 응대중",
    description: "AI 자동응답을 중지합니다.",
  },
  {
    value: "AI_ASSIST_ONLY",
    label: "AI 보조만 사용",
    description: "고객 자동 전송 없이 보조 상태로 둡니다.",
  },
];

const DEFAULT_RESPONSE_MODE: ConsultationResponseMode = "AI_ACTIVE";
const EMPTY_COMPOSER_DRAFT: ChatComposerDraft = {
  input: "",
  isNoteMode: false,
};

const getComposerDraftReleaseWarning = (draft: ChatComposerDraft) => {
  if (!draft.input.trim()) return null;
  return draft.isNoteMode
    ? "메시지 입력창에 작성 중인 내부 메모가 있습니다."
    : "메시지 입력창에 작성 중인 답변이 있습니다.";
};

const getResponseModeView = (mode?: ConsultationResponseMode | null) =>
  RESPONSE_MODE_OPTIONS.find((option) => option.value === mode) ?? RESPONSE_MODE_OPTIONS[0];

type EndSessionModalState =
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

type ReleaseAssignmentModalState =
  | { open: false }
  | {
      open: true;
      sessionId: string;
      customerName: string;
      isSubmitting: boolean;
      error: string | null;
    };

type ResolutionOutcomeOption = {
  value: ResolutionOutcome;
  label: string;
  description: string;
  status: Extract<ConsultationSessionStatus, "RESOLVED" | "COMPLETED">;
  followUpRequired: boolean;
};

const RESOLUTION_OUTCOME_OPTIONS: ResolutionOutcomeOption[] = [
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

const findResolutionOutcomeOption = (outcome: ResolutionOutcome | null) =>
  RESOLUTION_OUTCOME_OPTIONS.find((option) => option.value === outcome) ?? null;

const toUiMessage = (message: MessageLike): UiChatMessage => {
  const createdAt = message.createdAt ?? message.timestamp ?? new Date().toISOString();
  return {
    id: String(message.id ?? `message-${createdAt}-${message.content ?? ""}`),
    senderRole: normalizeChatSenderRole(message.senderRole),
    content: message.content ?? "",
    timestamp: formatTime(createdAt),
  };
};

const shouldRefreshMatchedWorkflow = (role: ChatSenderRole) =>
  role === "ASSISTANT" || role === "SYSTEM";

const isCounselorEchoRole = (role: ChatSenderRole) =>
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

const reconcileCounselorEchoMessage = (
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
  return messages.map((message) => (message.id === pendingMatch.id ? serverMessage : message));
};

const markMessageSending = (messages: UiChatMessage[], messageId: string) =>
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

type AssignmentView = {
  label: string;
  description: string;
  tone: "mine" | "unassigned" | "other" | "closed";
};

const getAssignmentView = (
  status?: string | null,
  assignedCounselorId?: number | null,
  currentCounselorId?: number | null,
): AssignmentView => {
  if (status === "COMPLETED" || status === "RESOLVED") {
    return {
      label: status === "RESOLVED" ? "해결됨" : "상담 종료",
      description: "종료된 세션이므로 메시지를 보낼 수 없습니다.",
      tone: "closed",
    };
  }

  if (assignedCounselorId && assignedCounselorId === currentCounselorId) {
    return {
      label: "내게 배정됨",
      description: "이 세션에 응답하고 내부 메모를 남길 수 있습니다.",
      tone: "mine",
    };
  }

  if (assignedCounselorId) {
    return {
      label: "다른 상담사 배정",
      description: "다른 상담사가 응대 중인 세션이므로 메시지를 보낼 수 없습니다.",
      tone: "other",
    };
  }

  return {
    label: "미배정",
    description: "배정받기 전에는 메시지와 내부 메모를 보낼 수 없습니다.",
    tone: "unassigned",
  };
};

const isCustomerMessageRole = (role?: string | null) => {
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

const toQueueCustomer = (
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

const sortQueueCustomers = (customers: QueueCustomerWithPanelData[]) =>
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

const replaceAssignedQueueCustomer = (
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

const getClaimSessionErrorMessage = (error: unknown) => {
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

const dedupePrependMessages = (
  olderMessages: UiChatMessage[],
  currentMessages: UiChatMessage[],
) => {
  const existingIds = new Set(currentMessages.map((message) => message.id));
  return [...olderMessages.filter((message) => !existingIds.has(message.id)), ...currentMessages];
};

const formatAverageFirstResponse = (seconds?: number | null) => {
  if (seconds == null) return "--";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}분 ${remainingSeconds}초` : `${remainingSeconds}초`;
};

const formatHandledTodayCount = (count?: number | null) => {
  return count == null ? "--" : `${count}건`;
};

type MetricsViewState = "loading" | "error" | "empty" | "ready";

type StatusRightProps = {
  metricsViewState: MetricsViewState;
  averageFirstResponseSeconds?: number | null;
  handledTodayCount?: number | null;
};

const formatMetricValue = (
  metricsViewState: MetricsViewState,
  value: number | null | undefined,
  formatter: (value?: number | null) => string,
) => {
  if (metricsViewState === "loading") return "로딩중";
  if (metricsViewState === "error") return "오류";
  if (metricsViewState === "empty") return "--";
  return formatter(value);
};

const StatusRight = ({
  metricsViewState,
  averageFirstResponseSeconds,
  handledTodayCount,
}: StatusRightProps) => {
  const averageLabel = formatMetricValue(
    metricsViewState,
    averageFirstResponseSeconds,
    formatAverageFirstResponse,
  );
  const handledLabel = formatMetricValue(
    metricsViewState,
    handledTodayCount,
    formatHandledTodayCount,
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Dot tone="signal" />
        <span style={{ fontSize: 12 }}>응대 가능</span>
      </div>
      <div style={{ width: 1, height: 16, background: "var(--line)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>평균 첫응답</Mono>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{averageLabel}</span>
      </div>
      <div style={{ width: 1, height: 16, background: "var(--line)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>오늘 처리</Mono>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{handledLabel}</span>
      </div>
    </div>
  );
};

export const ConsultationPage: React.FC = () => {
  const { setTopbarRight, setCrumbs, workspace } = useOutletContext<ShellContext>();
  const workspaceId = typeof workspace?.id === "number" ? workspace.id : null;
  const { workspaceId: workspaceIdParam, sessionId: routeSessionIdParam } = useParams<{
    workspaceId?: string;
    sessionId?: string;
  }>();
  const navigate = useNavigate();
  const workspacePathId = workspaceIdParam ?? (workspaceId ? String(workspaceId) : "");
  const routeSessionIdNumber = routeSessionIdParam ? Number(routeSessionIdParam) : null;
  const isRouteSessionIdValid =
    !routeSessionIdParam ||
    (Number.isInteger(routeSessionIdNumber) && Number(routeSessionIdNumber) > 0);
  const normalizedRouteSessionId =
    routeSessionIdParam && isRouteSessionIdValid ? String(routeSessionIdNumber) : null;
  const [queue, setQueue] = useState<QueueCustomerWithPanelData[]>([]);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [messagesCustomerId, setMessagesCustomerId] = useState<string | null>(null);
  const [messagePagination, setMessagePagination] = useState<MessagePaginationState>({
    nextPage: 0,
    totalPages: 0,
    isLoadingPrevious: false,
  });
  const [metrics, setMetrics] = useState<ConsultationMetrics | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [composerDrafts, setComposerDrafts] = useState<Record<string, ChatComposerDraft>>({});
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [queueLoadError, setQueueLoadError] = useState<string | null>(null);
  const [matchedWorkflow, setMatchedWorkflow] = useState<MatchedWorkflow | null>(null);
  const [isMatchedWorkflowLoading, setIsMatchedWorkflowLoading] = useState(false);
  const [isDraftResponseLoading, setIsDraftResponseLoading] = useState(false);
  const [endSessionModal, setEndSessionModal] = useState<EndSessionModalState>({ open: false });
  const [releaseAssignmentModal, setReleaseAssignmentModal] = useState<ReleaseAssignmentModalState>(
    { open: false },
  );
  const [isResponseModeUpdating, setIsResponseModeUpdating] = useState(false);
  const isEndSessionModalOpen = endSessionModal.open;
  const isEndSessionSubmitting = endSessionModal.open ? endSessionModal.isSubmitting : false;
  const isReleaseAssignmentModalOpen = releaseAssignmentModal.open;
  const isReleaseAssignmentSubmitting = releaseAssignmentModal.open
    ? releaseAssignmentModal.isSubmitting
    : false;
  const [hasQueueLoaded, setHasQueueLoaded] = useState(false);
  const [urlSessionUnavailable, setUrlSessionUnavailable] = useState(false);
  const [claimingSessionId, setClaimingSessionId] = useState<string | null>(null);
  const workflowRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMessagesRef = useRef<Map<string, PendingMessage>>(new Map());
  const tempCounterRef = useRef(0);
  const activeCustomerIdRef = useRef<string | null>(null);
  const hasQueueLoadedRef = useRef(false);
  const previousConnectionStatusRef = useRef<ConnectionStatus>("DISCONNECTED");
  const metricsErrorToastShownRef = useRef(false);
  const queueErrorToastShownRef = useRef(false);
  const currentCounselorId = getAuthUser()?.id ?? null;

  const failPendingMessage = useCallback((messageId: string, errorMessage?: string) => {
    const pending = pendingMessagesRef.current.get(messageId);
    if (!pending) return;

    clearTimeout(pending.timeoutId);
    pendingMessagesRef.current.delete(messageId);
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? {
              ...message,
              deliveryStatus: "failed",
              retryable: true,
              errorMessage,
            }
          : message,
      ),
    );
  }, []);

  const clearPendingMessages = useCallback(() => {
    pendingMessagesRef.current.forEach((pending) => clearTimeout(pending.timeoutId));
    pendingMessagesRef.current.clear();
  }, []);

  const handleServerError = useCallback(
    (error: unknown) => {
      const activeSessionId = activeCustomerIdRef.current;
      if (!activeSessionId) return;

      const pending = [...pendingMessagesRef.current.values()]
        .filter((item) => item.sessionId === activeSessionId)
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!pending) return;

      const errorMessage =
        typeof error === "object" &&
        error !== null &&
        "content" in error &&
        typeof (error as { content?: unknown }).content === "string"
          ? (error as { content: string }).content
          : "메시지 전송에 실패했습니다.";
      failPendingMessage(pending.id, errorMessage);
    },
    [failPendingMessage],
  );

  const { connectionStatus, subscribe, sendTo } = useStomp({ onServerError: handleServerError });

  const activeCustomer = queue.find((c) => c.id === activeCustomerId) || null;
  const activeCustomerName = activeCustomer?.name?.trim() || "Unknown";
  const activeCustomerInitial = activeCustomerName.charAt(0) || "?";
  const activeMetrics = metrics?.workspaceId === workspaceId ? metrics : null;
  const metricsViewState: MetricsViewState = isMetricsLoading
    ? "loading"
    : metricsError
      ? "error"
      : activeMetrics
        ? "ready"
        : "empty";
  const visibleMessages =
    activeCustomer && messagesCustomerId === activeCustomer.id ? messages : [];
  const hasPreviousMessages =
    !!activeCustomer &&
    messagesCustomerId === activeCustomer.id &&
    messagePagination.nextPage < messagePagination.totalPages;
  const selectedMessage = visibleMessages.find((m) => m.id === selectedMessageId) || null;
  const activeComposerDraft = activeCustomerId
    ? (composerDrafts[activeCustomerId] ?? EMPTY_COMPOSER_DRAFT)
    : EMPTY_COMPOSER_DRAFT;
  const activeMemoDraft = activeCustomerId ? (memos[activeCustomerId] ?? "") : "";
  const releaseWarningItems = [
    getComposerDraftReleaseWarning(activeComposerDraft),
    activeMemoDraft.trim() ? "우측 패널에 저장하지 않은 내부 메모가 있습니다." : null,
    selectedMessage ? "선택한 메시지 상세 맥락이 닫힙니다." : null,
  ].filter((item): item is string => item !== null);
  const activeAssignment = activeCustomer
    ? getAssignmentView(
        activeCustomer.status,
        activeCustomer.assignedCounselorId,
        currentCounselorId,
      )
    : null;
  const activeAssignmentToneClass = activeAssignment
    ? styles["assignmentBadge_" + activeAssignment.tone]
    : "";
  const isAssignedToCurrentCounselor =
    !!activeCustomer?.assignedCounselorId &&
    activeCustomer.assignedCounselorId === currentCounselorId;
  const isActiveSessionClosed =
    activeCustomer?.status === "COMPLETED" || activeCustomer?.status === "RESOLVED";
  const isActiveSessionUnassigned = !!activeCustomer && !activeCustomer.assignedCounselorId;
  const isClaimingActiveSession =
    activeCustomerId != null && claimingSessionId === activeCustomerId;
  const messageInputDisabledReason = isAssignedToCurrentCounselor
    ? undefined
    : activeAssignment?.description;
  const activeResponseModeView = getResponseModeView(activeCustomer?.responseMode);
  const queueSyncNotice =
    workspaceId && connectionStatus !== "CONNECTED"
      ? "실시간 연결이 불안정합니다. 복구되면 대기열을 다시 동기화합니다."
      : null;

  const clearActiveConversation = useCallback(() => {
    setActiveCustomerId(null);
    setSelectedMessageId(null);
    setMessages([]);
    setMessagesCustomerId(null);
    setMessagePagination({ nextPage: 0, totalPages: 0, isLoadingPrevious: false });
    setMatchedWorkflow(null);
    setIsMatchedWorkflowLoading(false);
    setIsDraftResponseLoading(false);
    setEndSessionModal({ open: false });
    setReleaseAssignmentModal({ open: false });
    clearPendingMessages();
  }, [clearPendingMessages]);

  const navigateToConsultationRoot = useCallback(() => {
    if (!workspacePathId) return;
    navigate(`/workspaces/${workspacePathId}/consultation`, { replace: true });
  }, [navigate, workspacePathId]);

  const loadMatchedWorkflow = useCallback(async (sessionId: number) => {
    // 매칭 워크플로우 바는 보조 패널이므로 실패 시 토스트 없이 바만 숨긴다.
    // getCurrentWorkflow는 오류를 흡수해 null을 반환하지만, 방어적으로 catch도 유지한다.
    try {
      return await getCurrentWorkflow(sessionId);
    } catch (error) {
      console.error("Failed to load matched workflow:", error);
      return null;
    }
  }, []);

  const refreshMatchedWorkflow = useCallback(
    async (sessionId: number) => {
      const workflow = await loadMatchedWorkflow(sessionId);
      if (activeCustomerIdRef.current === String(sessionId)) {
        setMatchedWorkflow(workflow);
      }
    },
    [loadMatchedWorkflow],
  );

  const scheduleMatchedWorkflowRefresh = useCallback(
    (sessionId: number) => {
      if (workflowRefetchTimerRef.current) {
        clearTimeout(workflowRefetchTimerRef.current);
      }
      workflowRefetchTimerRef.current = setTimeout(() => {
        workflowRefetchTimerRef.current = null;
        void refreshMatchedWorkflow(sessionId);
      }, 300);
    },
    [refreshMatchedWorkflow],
  );

  useEffect(() => {
    activeCustomerIdRef.current = activeCustomerId;
  }, [activeCustomerId]);

  useEffect(() => {
    hasQueueLoadedRef.current = hasQueueLoaded;
  }, [hasQueueLoaded]);

  useEffect(() => {
    setTopbarRight(
      <StatusRight
        metricsViewState={metricsViewState}
        averageFirstResponseSeconds={activeMetrics?.averageFirstResponseSeconds ?? null}
        handledTodayCount={activeMetrics?.handledTodayCount ?? null}
      />,
    );
    return () => {
      setTopbarRight(undefined);
    };
  }, [setTopbarRight, activeMetrics, metricsViewState]);

  useEffect(() => {
    setCrumbs(["CARD-CS", "실시간 상담"]);
    return () => {
      setCrumbs([]);
    };
  }, [setCrumbs]);

  useEffect(() => {
    if (!workspaceId) {
      setMetrics(null);
      setMetricsError(null);
      setIsMetricsLoading(false);
      return;
    }

    let cancelled = false;
    metricsErrorToastShownRef.current = false;
    setIsMetricsLoading(true);
    setMetricsError(null);

    const loadMetrics = async () => {
      try {
        const data = await consultationApi.getMetrics(workspaceId);
        if (cancelled) return;
        setMetrics(data);
        setMetricsError(null);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load consultation metrics:", error);
        setMetrics(null);
        setMetricsError("상담 지표를 불러오지 못했습니다.");
        if (!metricsErrorToastShownRef.current) {
          metricsErrorToastShownRef.current = true;
          toast.error("상담 지표를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setIsMetricsLoading(false);
        }
      }
    };

    void loadMetrics();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const loadQueue = useCallback(
    async (isManualRetry = false) => {
      if (!workspaceId) {
        setQueue([]);
        setHasQueueLoaded(false);
        setIsQueueLoading(false);
        setQueueLoadError(null);
        clearActiveConversation();
        return;
      }

      if (isManualRetry) {
        queueErrorToastShownRef.current = false;
      }

      setIsQueueLoading(true);
      setQueueLoadError(null);
      setHasQueueLoaded(false);

      try {
        const sessions = await consultationApi.getQueue(workspaceId);
        const formattedQueue = (Array.isArray(sessions) ? sessions : []).map((s) =>
          toQueueCustomer(s, currentCounselorId),
        );
        setQueue(sortQueueCustomers(formattedQueue));
        queueErrorToastShownRef.current = false;
        setHasQueueLoaded(true);
      } catch (error) {
        console.error("Failed to load queue:", error);
        setQueueLoadError("대기열을 불러오지 못했습니다.");
        if (!queueErrorToastShownRef.current) {
          queueErrorToastShownRef.current = true;
          toast.error("대기열을 불러오지 못했습니다.");
        }
        setHasQueueLoaded(true);
      } finally {
        setIsQueueLoading(false);
      }
    },
    [clearActiveConversation, currentCounselorId, workspaceId],
  );

  const handleQueueRetry = useCallback(() => {
    void loadQueue(true);
  }, [loadQueue]);

  const synchronizeQueueAfterClaimFailure = useCallback(
    async (targetSessionId: string) => {
      if (!workspaceId) return;

      try {
        const sessions = await consultationApi.getQueue(workspaceId);
        const formattedQueue = (Array.isArray(sessions) ? sessions : []).map((s) =>
          toQueueCustomer(s, currentCounselorId),
        );
        setQueue(sortQueueCustomers(formattedQueue));
        setQueueLoadError(null);
        setHasQueueLoaded(true);
        queueErrorToastShownRef.current = false;

        const latestTarget = formattedQueue.find((customer) => customer.id === targetSessionId);
        const isAssignedToAnotherCounselor =
          latestTarget?.assignedCounselorId != null &&
          latestTarget.assignedCounselorId !== currentCounselorId;
        if (!latestTarget || isAssignedToAnotherCounselor) {
          clearActiveConversation();
          navigateToConsultationRoot();
        }
      } catch (syncError) {
        console.error("Failed to synchronize queue after claim failure:", syncError);
        setQueueLoadError("대기열을 불러오지 못했습니다.");
        toast.error("배정 실패 후 최신 대기열을 불러오지 못했습니다.");
      }
    },
    [clearActiveConversation, currentCounselorId, navigateToConsultationRoot, workspaceId],
  );

  const handleQueueEvent = useCallback(
    (raw: unknown) => {
      const event = raw as Partial<ConsultationQueueEvent>;
      const session = event.session;
      if (!event.type || !session?.id) return;

      setQueueLoadError(null);
      const sessionId = String(session.id);
      if (event.type === "SESSION_REMOVED") {
        setQueue((prev) => prev.filter((customer) => customer.id !== sessionId));
        if (activeCustomerIdRef.current === sessionId) {
          clearActiveConversation();
          navigateToConsultationRoot();
        }
        return;
      }

      if (event.type !== "SESSION_UPSERTED") return;

      setQueue((prev) => {
        const currentIndex = prev.findIndex((customer) => customer.id === sessionId);
        const previous = currentIndex >= 0 ? prev[currentIndex] : undefined;
        const nextCustomerBase = toQueueCustomer(session, currentCounselorId, previous);
        const hasUnread =
          activeCustomerIdRef.current === sessionId
            ? false
            : isCustomerMessageRole(nextCustomerBase.lastMessageRole)
              ? true
              : (previous?.hasUnread ?? false);
        const nextCustomer = { ...nextCustomerBase, hasUnread };
        const next =
          currentIndex >= 0
            ? prev.map((customer) => (customer.id === sessionId ? nextCustomer : customer))
            : [nextCustomer, ...prev];
        return sortQueueCustomers(next);
      });
    },
    [clearActiveConversation, currentCounselorId, navigateToConsultationRoot],
  );

  useEffect(() => {
    queueErrorToastShownRef.current = false;
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    const previousStatus = previousConnectionStatusRef.current;
    previousConnectionStatusRef.current = connectionStatus;

    if (!workspaceId) return;
    if (connectionStatus !== "CONNECTED" || previousStatus === "CONNECTED") return;
    if (!hasQueueLoadedRef.current) return;

    void loadQueue();
  }, [connectionStatus, loadQueue, workspaceId]);

  const activateCustomer = useCallback((id: string) => {
    setActiveCustomerId(id);
    setSelectedMessageId(null);
    setQueue((prev) =>
      prev.some((customer) => customer.id === id && customer.hasUnread)
        ? prev.map((customer) =>
            customer.id === id ? { ...customer, hasUnread: false } : customer,
          )
        : prev,
    );
  }, []);

  useEffect(() => {
    if (!routeSessionIdParam) {
      setUrlSessionUnavailable(false);
      if (workspaceIdParam && activeCustomerIdRef.current) {
        clearActiveConversation();
      }
      return;
    }

    if (!isRouteSessionIdValid || !normalizedRouteSessionId) {
      setUrlSessionUnavailable(true);
      clearActiveConversation();
      return;
    }

    if (!hasQueueLoaded || isQueueLoading || queueLoadError) return;

    const routeSession = queue.find((customer) => customer.id === normalizedRouteSessionId);
    if (!routeSession) {
      setUrlSessionUnavailable(true);
      clearActiveConversation();
      return;
    }

    setUrlSessionUnavailable(false);
    activateCustomer(normalizedRouteSessionId);
  }, [
    activateCustomer,
    clearActiveConversation,
    hasQueueLoaded,
    isQueueLoading,
    isRouteSessionIdValid,
    normalizedRouteSessionId,
    queue,
    queueLoadError,
    routeSessionIdParam,
    workspaceIdParam,
  ]);

  useEffect(() => {
    if (!workspaceId) return;

    const unsubscribe = subscribe(
      `/topic/workspaces.${workspaceId}.consultation.queue`,
      handleQueueEvent,
    );

    return () => {
      unsubscribe();
    };
  }, [handleQueueEvent, subscribe, workspaceId]);

  useEffect(() => {
    if (!activeCustomerId) {
      setMatchedWorkflow(null);
      setIsMatchedWorkflowLoading(false);
      setIsDraftResponseLoading(false);
      return;
    }

    let cancelled = false;
    setMatchedWorkflow(null);
    setIsMatchedWorkflowLoading(true);
    void loadMatchedWorkflow(Number(activeCustomerId)).then((workflow) => {
      if (cancelled) return;
      setMatchedWorkflow(workflow);
      setIsMatchedWorkflowLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [activeCustomerId, loadMatchedWorkflow]);

  useEffect(() => {
    return () => {
      if (workflowRefetchTimerRef.current) {
        clearTimeout(workflowRefetchTimerRef.current);
        workflowRefetchTimerRef.current = null;
      }
      clearPendingMessages();
    };
  }, [clearPendingMessages]);

  useEffect(() => {
    if (!activeCustomerId) {
      clearPendingMessages();
      setMessages([]);
      setMessagesCustomerId(null);
      setMessagePagination({ nextPage: 0, totalPages: 0, isLoadingPrevious: false });
      setSelectedMessageId(null);
      return;
    }

    clearPendingMessages();
    setMessages([]);
    setMessagesCustomerId(null);
    setMessagePagination({ nextPage: 0, totalPages: 0, isLoadingPrevious: false });
    setSelectedMessageId(null);

    let cancelled = false;

    const loadMessages = async () => {
      try {
        const messagePage = await consultationApi.getMessagePage(Number(activeCustomerId), {
          page: 0,
          size: MESSAGE_PAGE_SIZE,
        });
        if (cancelled) return;
        setMessages(messagePage.content.map(toUiMessage));
        setMessagesCustomerId(activeCustomerId);
        setMessagePagination({
          nextPage: messagePage.page + 1,
          totalPages: messagePage.totalPages,
          isLoadingPrevious: false,
        });
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load messages:", error);
          toast.error("메시지를 불러오지 못했습니다.");
        }
      }
    };

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [activeCustomerId, clearPendingMessages]);

  const handleLoadPreviousMessages = useCallback(async () => {
    if (
      !activeCustomerId ||
      messagesCustomerId !== activeCustomerId ||
      messagePagination.isLoadingPrevious ||
      messagePagination.nextPage >= messagePagination.totalPages
    ) {
      return;
    }

    const targetSessionId = activeCustomerId;
    const targetPage = messagePagination.nextPage;
    setMessagePagination((current) => ({ ...current, isLoadingPrevious: true }));
    try {
      const messagePage = await consultationApi.getMessagePage(Number(targetSessionId), {
        page: targetPage,
        size: MESSAGE_PAGE_SIZE,
      });
      if (activeCustomerIdRef.current !== targetSessionId) return;
      setMessages((current) =>
        dedupePrependMessages(messagePage.content.map(toUiMessage), current),
      );
      setMessagesCustomerId(targetSessionId);
      setMessagePagination({
        nextPage: messagePage.page + 1,
        totalPages: messagePage.totalPages,
        isLoadingPrevious: false,
      });
    } catch (error) {
      console.error("Failed to load previous messages:", error);
      toast.error("이전 메시지를 불러오지 못했습니다.");
      setMessagePagination((current) => ({ ...current, isLoadingPrevious: false }));
    }
  }, [activeCustomerId, messagePagination, messagesCustomerId]);

  useEffect(() => {
    if (!activeCustomerId) return;

    const topic = `/topic/chat.${activeCustomerId}`;
    const unsubscribe = subscribe(topic, (raw) => {
      const msg = raw as RealtimeChatMessage;
      const normalizedRole = normalizeChatSenderRole(msg.senderRole);
      if (shouldRefreshMatchedWorkflow(normalizedRole)) {
        scheduleMatchedWorkflowRefresh(Number(activeCustomerId));
      }
      if (isCounselorEchoRole(normalizedRole)) {
        setMessagesCustomerId(activeCustomerId);
        setMessages((prev) =>
          reconcileCounselorEchoMessage(
            prev,
            pendingMessagesRef.current,
            activeCustomerId,
            normalizedRole,
            msg,
          ),
        );
        return;
      }
      const msgId = String(msg.id);
      setMessagesCustomerId(activeCustomerId);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msgId)) return prev;
        return [...prev, toUiMessage(msg)];
      });
    });

    return () => {
      unsubscribe();
      if (workflowRefetchTimerRef.current) {
        clearTimeout(workflowRefetchTimerRef.current);
        workflowRefetchTimerRef.current = null;
      }
    };
  }, [activeCustomerId, subscribe, scheduleMatchedWorkflowRefresh]);

  const registerPendingMessage = useCallback(
    (message: Omit<PendingMessage, "timeoutId">) => {
      const timeoutId = setTimeout(
        () => failPendingMessage(message.id, "서버 응답 시간이 초과되었습니다."),
        COUNSELOR_MESSAGE_ACK_TIMEOUT_MS,
      );
      pendingMessagesRef.current.set(message.id, {
        ...message,
        timeoutId,
      });
    },
    [failPendingMessage],
  );

  const handleSelectCustomer = useCallback(
    (id: string) => {
      setUrlSessionUnavailable(false);
      activateCustomer(id);
      if (workspacePathId) {
        navigate(`/workspaces/${workspacePathId}/consultation/${id}`);
      }
    },
    [activateCustomer, navigate, workspacePathId],
  );

  const handleClaimSession = useCallback(async () => {
    if (
      !activeCustomerId ||
      !currentCounselorId ||
      !activeCustomer ||
      activeCustomer.assignedCounselorId ||
      isActiveSessionClosed ||
      claimingSessionId
    ) {
      return;
    }

    const targetSessionId = activeCustomerId;
    setClaimingSessionId(targetSessionId);
    try {
      const assignedSession = await consultationApi.assignSession(Number(targetSessionId));
      setQueue((prev) =>
        replaceAssignedQueueCustomer(prev, targetSessionId, assignedSession, currentCounselorId),
      );
      toast.success("상담 세션이 배정되었습니다.");
    } catch (error) {
      console.error("Failed to claim session:", error);
      toast.error(getClaimSessionErrorMessage(error));
      await synchronizeQueueAfterClaimFailure(targetSessionId);
    } finally {
      setClaimingSessionId((current) => (current === targetSessionId ? null : current));
    }
  }, [
    activeCustomer,
    activeCustomerId,
    claimingSessionId,
    currentCounselorId,
    isActiveSessionClosed,
    synchronizeQueueAfterClaimFailure,
  ]);

  const handleSendMessage = useCallback(
    (content: string, isNote: boolean) => {
      if (!activeCustomerId || !isAssignedToCurrentCounselor) return;
      if (connectionStatus !== "CONNECTED") {
        toast.error("연결이 불안정합니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      const targetId = activeCustomerId;

      const optimisticMsg: UiChatMessage = {
        id: `temp-${Date.now()}-${++tempCounterRef.current}`,
        senderRole: isNote ? "NOTE" : "COUNSELOR",
        content,
        timestamp: formatTime(new Date().toISOString()),
        deliveryStatus: "sending",
        retryable: false,
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setMessagesCustomerId(targetId);
      registerPendingMessage({
        id: optimisticMsg.id,
        sessionId: targetId,
        content,
        isNote,
        createdAt: Date.now(),
      });
      setSelectedMessageId(null);

      sendTo("/app/chat.counselor.send", {
        sessionId: Number(targetId),
        content,
        isNote,
      });
    },
    [
      activeCustomerId,
      connectionStatus,
      isAssignedToCurrentCounselor,
      registerPendingMessage,
      sendTo,
    ],
  );

  const handleRetryMessage = useCallback(
    (messageId: string) => {
      if (!activeCustomerId || !isAssignedToCurrentCounselor) return;
      if (connectionStatus !== "CONNECTED") {
        toast.error("연결이 불안정합니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      const failedMessage = messages.find((message) => message.id === messageId);
      if (failedMessage?.deliveryStatus !== "failed") return;

      const isNote = failedMessage.senderRole === "NOTE";
      const targetId = activeCustomerId;
      setMessages((prev) => markMessageSending(prev, messageId));
      registerPendingMessage({
        id: messageId,
        sessionId: targetId,
        content: failedMessage.content,
        isNote,
        createdAt: Date.now(),
      });
      setSelectedMessageId(null);

      sendTo("/app/chat.counselor.send", {
        sessionId: Number(targetId),
        content: failedMessage.content,
        isNote,
      });
    },
    [
      activeCustomerId,
      connectionStatus,
      isAssignedToCurrentCounselor,
      messages,
      registerPendingMessage,
      sendTo,
    ],
  );

  const handleInsertDraftResponse = useCallback(async () => {
    if (!activeCustomerId || !matchedWorkflow || !isAssignedToCurrentCounselor) return "";
    setIsDraftResponseLoading(true);
    try {
      const draft = await consultationApi.generateDraftResponse(Number(activeCustomerId));
      if (!draft.content.trim()) {
        toast.error("답변 초안을 생성하지 못했습니다. 기존 입력 내용은 유지됩니다.");
        return "";
      }
      toast.success("답변 초안을 입력창에 삽입했습니다.");
      return draft.content;
    } catch (error) {
      console.error("Failed to generate draft response:", error);
      toast.error("답변 초안을 생성하지 못했습니다. 기존 입력 내용은 유지됩니다.");
      throw error;
    } finally {
      setIsDraftResponseLoading(false);
    }
  }, [activeCustomerId, isAssignedToCurrentCounselor, matchedWorkflow]);

  const handleOpenEndSession = () => {
    if (!activeCustomerId || !isAssignedToCurrentCounselor) return;
    setEndSessionModal({
      open: true,
      sessionId: activeCustomerId,
      customerName: activeCustomerName,
      outcome: null,
      reason: "",
      isSubmitting: false,
      error: null,
    });
  };

  const handleCancelEndSession = () => {
    setEndSessionModal({ open: false });
  };

  useEffect(() => {
    if (!isEndSessionModalOpen || isEndSessionSubmitting) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEndSessionModal({ open: false });
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [isEndSessionModalOpen, isEndSessionSubmitting]);

  useEffect(() => {
    if (!isReleaseAssignmentModalOpen || isReleaseAssignmentSubmitting) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReleaseAssignmentModal({ open: false });
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [isReleaseAssignmentModalOpen, isReleaseAssignmentSubmitting]);

  const handleSelectResolutionOutcome = (outcome: ResolutionOutcome) => {
    setEndSessionModal((prev) => (prev.open ? { ...prev, outcome, error: null } : prev));
  };

  const handleChangeResolutionReason = (reason: string) => {
    setEndSessionModal((prev) => (prev.open ? { ...prev, reason, error: null } : prev));
  };

  const handleConfirmEndSession = async () => {
    if (!endSessionModal.open || endSessionModal.isSubmitting) return;
    const selectedOutcome = findResolutionOutcomeOption(endSessionModal.outcome);
    if (!selectedOutcome) {
      setEndSessionModal((prev) =>
        prev.open ? { ...prev, error: "처리 결과를 선택하세요." } : prev,
      );
      return;
    }
    const endedSessionId = endSessionModal.sessionId;
    setEndSessionModal((prev) => (prev.open ? { ...prev, isSubmitting: true, error: null } : prev));
    try {
      const trimmedReason = endSessionModal.reason.trim();
      await consultationApi.updateStatus(Number(endedSessionId), {
        status: selectedOutcome.status,
        resolutionOutcome: selectedOutcome.value,
        resolutionReason: trimmedReason || undefined,
        followUpRequired: selectedOutcome.followUpRequired,
      });
      toast.success("상담이 종료되었습니다.");
      setQueue((prev) => prev.filter((customer) => customer.id !== endedSessionId));
      clearActiveConversation();
      setEndSessionModal({ open: false });
      navigateToConsultationRoot();
    } catch {
      setEndSessionModal((prev) =>
        prev.open
          ? {
              ...prev,
              isSubmitting: false,
              error: "상담 종료 요청을 완료하지 못했습니다.",
            }
          : prev,
      );
      toast.error("세션 종료 실패");
    }
  };

  const handleOpenReleaseAssignment = () => {
    if (!activeCustomerId || !currentCounselorId || !isAssignedToCurrentCounselor) return;
    setReleaseAssignmentModal({
      open: true,
      sessionId: activeCustomerId,
      customerName: activeCustomerName,
      isSubmitting: false,
      error: null,
    });
  };

  const handleCancelReleaseAssignment = () => {
    setReleaseAssignmentModal({ open: false });
  };

  const handleConfirmReleaseAssignment = async () => {
    if (
      !releaseAssignmentModal.open ||
      releaseAssignmentModal.isSubmitting ||
      !currentCounselorId
    ) {
      return;
    }

    const releasedSessionId = releaseAssignmentModal.sessionId;
    setReleaseAssignmentModal((prev) =>
      prev.open ? { ...prev, isSubmitting: true, error: null } : prev,
    );

    try {
      const releasedSession = await consultationApi.releaseSession(Number(releasedSessionId));
      setQueue((prev) =>
        sortQueueCustomers(
          prev.map((customer) =>
            customer.id === releasedSessionId
              ? toQueueCustomer(releasedSession, currentCounselorId, customer)
              : customer,
          ),
        ),
      );
      setMemos((prev) => {
        const next = { ...prev };
        delete next[releasedSessionId];
        return next;
      });
      setComposerDrafts((prev) => {
        const next = { ...prev };
        delete next[releasedSessionId];
        return next;
      });
      toast.success("상담 배정이 해제되었습니다.");
      clearActiveConversation();
      setReleaseAssignmentModal({ open: false });
      navigateToConsultationRoot();
    } catch (error) {
      console.error("Failed to release session:", error);
      setReleaseAssignmentModal((prev) =>
        prev.open
          ? {
              ...prev,
              isSubmitting: false,
              error: "상담 배정 해제를 완료하지 못했습니다.",
            }
          : prev,
      );
      toast.error("상담 배정 해제에 실패했습니다.");
    }
  };

  const handleUpdateResponseMode = async (responseMode: ConsultationResponseMode) => {
    if (
      !activeCustomerId ||
      !currentCounselorId ||
      !isAssignedToCurrentCounselor ||
      responseMode === activeCustomer?.responseMode ||
      isResponseModeUpdating
    ) {
      return;
    }

    setIsResponseModeUpdating(true);
    try {
      const updatedSession = await consultationApi.updateResponseMode(
        Number(activeCustomerId),
        currentCounselorId,
        responseMode,
      );
      setQueue((prev) =>
        sortQueueCustomers(
          prev.map((customer) =>
            customer.id === activeCustomerId
              ? toQueueCustomer(updatedSession, currentCounselorId, customer)
              : customer,
          ),
        ),
      );
      toast.success("AI 응대 모드가 변경되었습니다.");
    } catch (error) {
      console.error("Failed to update response mode:", error);
      toast.error("AI 응대 모드 변경에 실패했습니다.");
    } finally {
      setIsResponseModeUpdating(false);
    }
  };

  const handleSaveMemo = useCallback(() => {
    if (!activeCustomerId || !isAssignedToCurrentCounselor) return;

    const requestCustomerId = activeCustomerId;
    const memo = (memos[activeCustomerId] ?? "").trim();
    if (!memo) return;

    if (connectionStatus !== "CONNECTED") {
      toast.error("연결이 불안정합니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    if (activeCustomerIdRef.current === requestCustomerId) {
      handleSendMessage(memo, true);
      setMemos((prev) => ({ ...prev, [requestCustomerId]: "" }));
      toast.success("내부 메모를 타임라인에 남겼습니다.");
    }
  }, [activeCustomerId, connectionStatus, handleSendMessage, isAssignedToCurrentCounselor, memos]);

  return (
    <div className={styles.consultationRoot}>
      <div className={styles.queuePane}>
        <QueuePanel
          customers={queue}
          activeCustomerId={activeCustomerId}
          currentCounselorId={currentCounselorId}
          onSelectCustomer={handleSelectCustomer}
          isLoading={isQueueLoading}
          loadError={queueLoadError}
          syncNotice={queueSyncNotice}
          onRetry={handleQueueRetry}
        />
      </div>

      <div className={styles.conversationPane}>
        {activeCustomer && (
          <div className={styles.conversationHeader}>
            <div className={styles.conversationHeaderTop}>
              <div className={styles.customerTitle}>
                <Avatar initial={activeCustomerInitial} tone="warn" size={36} />
                <div>
                  <div className={styles.customerName}>{activeCustomerName} 고객</div>
                  <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>
                    {activeCustomer.channel ?? ""} ·{" "}
                    {formatWaitDuration(activeCustomer.waitMinutes)} 대기 중
                  </Mono>
                </div>
              </div>
            </div>
            <div className={styles.conversationActions}>
              {activeAssignment && (
                <div
                  className={`${styles.assignmentBadge} ${activeAssignmentToneClass}`}
                  data-testid="conversation-assignment-status"
                >
                  <span>{activeAssignment.label}</span>
                  <small>{activeAssignment.description}</small>
                </div>
              )}
              {isActiveSessionUnassigned && !isActiveSessionClosed && (
                <button
                  type="button"
                  className={styles.claimButton}
                  onClick={handleClaimSession}
                  disabled={!currentCounselorId || isClaimingActiveSession}
                >
                  {isClaimingActiveSession ? "배정 중..." : "배정받기"}
                </button>
              )}
              <div className={styles.responseModePanel}>
                <div className={styles.responseModeSummary}>
                  <Mono className={styles.responseModeEyebrow}>AI MODE</Mono>
                  <span>{activeResponseModeView.label}</span>
                </div>
                <div className={styles.responseModeControl} aria-label="AI 응대 모드">
                  {RESPONSE_MODE_OPTIONS.map((option) => {
                    const isSelected = activeResponseModeView.value === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.responseModeButton} ${
                          isSelected ? styles.responseModeButtonActive : ""
                        }`}
                        aria-pressed={isSelected}
                        title={option.description}
                        disabled={!isAssignedToCurrentCounselor || isResponseModeUpdating}
                        onClick={() => handleUpdateResponseMode(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                className={styles.linkButton}
                onClick={handleOpenReleaseAssignment}
                disabled={!isAssignedToCurrentCounselor}
              >
                배정 해제
              </button>
              <button
                onClick={handleOpenEndSession}
                className={styles.dangerButton}
                disabled={!isAssignedToCurrentCounselor}
              >
                상담 종료
              </button>
            </div>
          </div>
        )}

        <div className={styles.chatPanelSlot}>
          {urlSessionUnavailable ? (
            <div className={styles.urlSessionState} role="status" aria-live="polite">
              <p className={styles.urlSessionTitle}>요청한 상담 세션을 찾을 수 없습니다</p>
              <p className={styles.urlSessionText}>
                상담이 종료되었거나 현재 대기열에서 접근할 수 없는 세션입니다.
              </p>
            </div>
          ) : (
            <ChatPanel
              sessionId={activeCustomerId}
              customerName={activeCustomer ? activeCustomerName : null}
              channel={activeCustomer?.channel || null}
              messages={visibleMessages}
              onSendMessage={handleSendMessage}
              onRetryMessage={handleRetryMessage}
              selectedMessageId={selectedMessageId}
              onSelectMessage={setSelectedMessageId}
              sessionStatusLabel={activeAssignment?.label}
              sessionStatusDescription={activeAssignment?.description}
              disabledReason={messageInputDisabledReason}
              disabled={!isAssignedToCurrentCounselor}
              hasPreviousMessages={hasPreviousMessages}
              isLoadingPreviousMessages={messagePagination.isLoadingPrevious}
              onLoadPreviousMessages={handleLoadPreviousMessages}
              draftResponseAction={
                matchedWorkflow && isAssignedToCurrentCounselor
                  ? {
                      isLoading: isDraftResponseLoading,
                      onInsert: handleInsertDraftResponse,
                    }
                  : undefined
              }
              composerDraft={activeComposerDraft}
              onComposerDraftChange={(draft) => {
                if (!activeCustomerId) return;
                setComposerDrafts((prev) => ({ ...prev, [activeCustomerId]: draft }));
              }}
            />
          )}
        </div>
      </div>

      <div className={styles.detailPane}>
        {activeCustomerId && (isMatchedWorkflowLoading || matchedWorkflow) && (
          <div className={styles.detailPaneTop}>
            {matchedWorkflow ? (
              <MatchedWorkflowBar workflow={matchedWorkflow} />
            ) : (
              <MatchedWorkflowBarSkeleton />
            )}
          </div>
        )}
        <div className={styles.detailPaneBody}>
          {selectedMessage ? (
            <MessageDetailPanel
              message={selectedMessage}
              onClose={() => setSelectedMessageId(null)}
            />
          ) : (
            <CustomerPanel
              customer={
                activeCustomer
                  ? {
                      name: activeCustomerName,
                      channel: activeCustomer.channel,
                      handoffRequired: activeCustomer.handoffRequired,
                      handoffReason: activeCustomer.handoffReason,
                      handoffAt: activeCustomer.handoffAt,
                      membershipTier: activeCustomer.customerInfo.membershipTier,
                      contact: activeCustomer.customerInfo.contact,
                      email: activeCustomer.customerInfo.email,
                    }
                  : null
              }
              orderInfo={activeCustomer?.orderInfo ?? null}
              extractedInfo={activeCustomer?.extractedInfo ?? null}
              memo={activeCustomerId ? memos[activeCustomerId] || "" : ""}
              onMemoChange={(val) => {
                if (activeCustomerId) {
                  setMemos((prev) => ({ ...prev, [activeCustomerId]: val }));
                }
              }}
              onMemoSave={isAssignedToCurrentCounselor ? handleSaveMemo : undefined}
            />
          )}
        </div>
      </div>

      {endSessionModal.open && (
        <div className={styles.modalOverlay}>
          <button
            type="button"
            className={styles.modalBackdrop}
            aria-label="상담 종료 모달 닫기"
            onClick={handleCancelEndSession}
            disabled={endSessionModal.isSubmitting}
          />
          <dialog
            open
            className={styles.endSessionDialog}
            aria-modal="true"
            aria-labelledby="end-session-title"
          >
            <div className={styles.modalHeader}>
              <Mono className={styles.modalEyebrow}>END CONSULTATION</Mono>
              <h2 id="end-session-title" className={styles.modalTitle}>
                {endSessionModal.customerName} 고객 상담 종료
              </h2>
            </div>

            <fieldset className={styles.outcomeFieldset}>
              <legend className={styles.fieldLabel}>처리 결과</legend>
              <div className={styles.outcomeGrid}>
                {RESOLUTION_OUTCOME_OPTIONS.map((option) => {
                  const isSelected = endSessionModal.outcome === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.outcomeButton} ${isSelected ? styles.outcomeButtonSelected : ""}`}
                      aria-pressed={isSelected}
                      onClick={() => handleSelectResolutionOutcome(option.value)}
                      disabled={endSessionModal.isSubmitting}
                    >
                      <span className={styles.outcomeLabel}>{option.label}</span>
                      <span className={styles.outcomeDescription}>{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className={styles.reasonLabel} htmlFor="end-session-reason">
              종료 사유 또는 내부 메모
            </label>
            <textarea
              id="end-session-reason"
              className={styles.reasonTextarea}
              value={endSessionModal.reason}
              onChange={(event) => handleChangeResolutionReason(event.target.value)}
              placeholder="처리 결과를 이해할 수 있는 짧은 메모를 남기세요."
              disabled={endSessionModal.isSubmitting}
            />

            {findResolutionOutcomeOption(endSessionModal.outcome)?.followUpRequired && (
              <div className={styles.followUpNotice}>후속 연락 필요 항목으로 기록됩니다.</div>
            )}
            {endSessionModal.error && (
              <div className={styles.modalError} role="alert">
                {endSessionModal.error}
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={handleCancelEndSession}
                disabled={endSessionModal.isSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.confirmDangerAction}
                onClick={handleConfirmEndSession}
                disabled={endSessionModal.isSubmitting || !endSessionModal.outcome}
              >
                {endSessionModal.isSubmitting ? "종료 중..." : "종료 확인"}
              </button>
            </div>
          </dialog>
        </div>
      )}

      {releaseAssignmentModal.open && (
        <div className={styles.modalOverlay}>
          <button
            type="button"
            className={styles.modalBackdrop}
            aria-label="배정 해제 모달 닫기"
            onClick={handleCancelReleaseAssignment}
            disabled={releaseAssignmentModal.isSubmitting}
          />
          <dialog
            open
            className={styles.endSessionDialog}
            aria-modal="true"
            aria-labelledby="release-assignment-title"
          >
            <div className={styles.modalHeader}>
              <Mono className={styles.modalEyebrow}>RELEASE ASSIGNMENT</Mono>
              <h2 id="release-assignment-title" className={styles.modalTitle}>
                {releaseAssignmentModal.customerName} 고객 배정 해제
              </h2>
            </div>

            <div className={styles.releaseNotice}>
              해제하면 이 세션은 다시 미배정 대기열로 돌아가며, 현재 상담 화면은 비워집니다.
            </div>

            {releaseWarningItems.length > 0 && (
              <div className={styles.releaseWarning} role="alert">
                <strong>해제 전에 확인하세요</strong>
                <ul className={styles.releaseWarningList}>
                  {releaseWarningItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {releaseAssignmentModal.error && (
              <div className={styles.modalError} role="alert">
                {releaseAssignmentModal.error}
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={handleCancelReleaseAssignment}
                disabled={releaseAssignmentModal.isSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.confirmDangerAction}
                onClick={handleConfirmReleaseAssignment}
                disabled={releaseAssignmentModal.isSubmitting}
              >
                {releaseAssignmentModal.isSubmitting ? "해제 중..." : "해제 확인"}
              </button>
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
};
