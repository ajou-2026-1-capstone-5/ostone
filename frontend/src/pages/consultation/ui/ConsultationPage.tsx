import React, { useState, useEffect, useCallback, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import type { ShellContext } from "@/shared/ui/ostone/chrome";
import { Dot, Mono, Avatar } from "@/shared/ui/ostone/atoms";
import { useStomp } from "@/shared/lib/websocket";
import { getAuthUser } from "@/shared/lib/auth";
import { QueuePanel } from "../../../features/consultation/ui/QueuePanel";
import type { QueueCustomer } from "../../../features/consultation/ui/QueuePanel";
import { ChatPanel } from "../../../features/consultation/ui/ChatPanel";
import type { ChatMessage as UiChatMessage } from "../../../features/consultation/ui/ChatPanel";
import { normalizeChatSenderRole } from "../../../features/consultation/lib/chatRoleLabels";
import { consultationApi } from "../../../features/consultation/api/consultationApi";
import type {
  ChatSession,
  ConsultationMetrics,
  ConsultationQueueEvent,
} from "../../../features/consultation/api/consultationApi";
import { CustomerPanel } from "./sections/CustomerPanel";
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

type SessionMeta = {
  customerName?: string;
  handoffReason?: string;
  title?: string;
  lastMessagePreview?: string;
  lastMessageRole?: string;
  lastMessageAt?: string;
};

const toUiMessage = (message: MessageLike): UiChatMessage => {
  const createdAt = message.createdAt ?? message.timestamp ?? new Date().toISOString();
  return {
    id: String(message.id ?? `message-${createdAt}-${message.content ?? ""}`),
    senderRole: normalizeChatSenderRole(message.senderRole),
    content: message.content ?? "",
    timestamp: formatTime(createdAt),
  };
};

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
  return diffMinutes === 0 ? "방금 전" : `${diffMinutes}분 전`;
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

const getSessionStatusLabel = (
  status?: string | null,
  assignedCounselorId?: number | null,
  currentCounselorId?: number | null,
) => {
  if (status === "COMPLETED") return "상담 종료";
  if (status === "RESOLVED") return "해결됨";
  if (assignedCounselorId && assignedCounselorId === currentCounselorId) return "내게 배정됨";
  if (assignedCounselorId) return "다른 상담사 배정";
  if (status === "ACTIVE") return "미배정";
  if (status === "OPEN") return "미배정";
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
      description: "다른 상담사가 응대 중인 세션입니다.",
      tone: "other",
    };
  }

  return {
    label: "미배정",
    description: "선택하면 자동으로 내게 배정됩니다.",
    tone: "unassigned",
  };
};

const isCustomerMessageRole = (role?: string | null) => {
  const normalizedRole = normalizeChatSenderRole(role);
  return normalizedRole === "USER" || normalizedRole === "CUSTOMER";
};

const getQueueSortTime = (customer: QueueCustomer) => {
  const timeSource = customer.lastMessageAt ?? customer.startedAt;
  if (!timeSource) return 0;
  const timestamp = new Date(timeSource).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const toQueueCustomer = (
  session: ChatSession,
  currentCounselorId: number | null,
  previous?: QueueCustomer,
  options?: { hasUnread?: boolean },
): QueueCustomer => {
  const meta = parseSessionMeta(session.metaJson);
  const assignedCounselorId =
    session.assignedCounselorId !== undefined
      ? session.assignedCounselorId
      : (previous?.assignedCounselorId ?? null);
  const status = session.status !== undefined ? session.status : (previous?.status ?? null);
  const startedAt = session.startedAt ?? previous?.startedAt ?? null;
  const lastMessagePreview = meta.lastMessagePreview?.trim() || previous?.lastMessagePreview || "";
  const lastMessageRole = meta.lastMessageRole ?? previous?.lastMessageRole;
  const lastMessageAt = meta.lastMessageAt ?? previous?.lastMessageAt ?? null;
  const lastMessageTimeLabel =
    formatLastMessageTimeLabel(lastMessageAt) || previous?.lastMessageTimeLabel;

  return {
    id: String(session.id ?? previous?.id ?? ""),
    name: meta.customerName?.trim() || previous?.name || "Unknown",
    title: meta.title?.trim() || previous?.title || "",
    channel: session.channel ?? previous?.channel ?? "",
    handoffReason: meta.handoffReason ?? previous?.handoffReason ?? "",
    waitMinutes: startedAt ? calcWaitMinutes(startedAt) : (previous?.waitMinutes ?? 0),
    hasUnread: options?.hasUnread ?? previous?.hasUnread ?? false,
    lastMessagePreview,
    lastMessageRole,
    lastMessageAt,
    lastMessageTimeLabel,
    status,
    statusLabel: getSessionStatusLabel(status, assignedCounselorId, currentCounselorId),
    assignedCounselorId,
    startedAt,
  };
};

const sortQueueCustomers = (customers: QueueCustomer[]) =>
  [...customers].sort((a, b) => {
    return getQueueSortTime(b) - getQueueSortTime(a);
  });

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
  const [queue, setQueue] = useState<QueueCustomer[]>([]);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [messagesCustomerId, setMessagesCustomerId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ConsultationMetrics | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [queueLoadError, setQueueLoadError] = useState<string | null>(null);
  const [matchedWorkflow, setMatchedWorkflow] = useState<MatchedWorkflow | null>(null);
  const [isMatchedWorkflowLoading, setIsMatchedWorkflowLoading] = useState(false);
  const workflowRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { connectionStatus, subscribe, sendTo } = useStomp();
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const tempCounterRef = useRef(0);
  const activeCustomerIdRef = useRef<string | null>(null);
  const metricsErrorToastShownRef = useRef(false);
  const queueErrorToastShownRef = useRef(false);
  const currentCounselorId = getAuthUser()?.id ?? null;

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
  const selectedMessage = visibleMessages.find((m) => m.id === selectedMessageId) || null;
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

  const clearActiveConversation = useCallback(() => {
    setActiveCustomerId(null);
    setSelectedMessageId(null);
    setMessages([]);
    setMessagesCustomerId(null);
    setMatchedWorkflow(null);
    setIsMatchedWorkflowLoading(false);
    pendingIdsRef.current.clear();
  }, []);

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

  useEffect(() => {
    activeCustomerIdRef.current = activeCustomerId;
  }, [activeCustomerId]);

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

      try {
        const sessions = await consultationApi.getQueue(workspaceId);
        const formattedQueue = (Array.isArray(sessions) ? sessions : []).map((s) =>
          toQueueCustomer(s, currentCounselorId),
        );
        setQueue(sortQueueCustomers(formattedQueue));
        queueErrorToastShownRef.current = false;
      } catch (error) {
        console.error("Failed to load queue:", error);
        setQueueLoadError("대기열을 불러오지 못했습니다.");
        if (!queueErrorToastShownRef.current) {
          queueErrorToastShownRef.current = true;
          toast.error("대기열을 불러오지 못했습니다.");
        }
      } finally {
        setIsQueueLoading(false);
      }
    },
    [clearActiveConversation, currentCounselorId, workspaceId],
  );

  const handleQueueRetry = useCallback(() => {
    void loadQueue(true);
  }, [loadQueue]);

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
    [clearActiveConversation, currentCounselorId],
  );

  useEffect(() => {
    queueErrorToastShownRef.current = false;
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (connectionStatus !== "CONNECTED" || !workspaceId) return;

    const unsubscribe = subscribe(
      `/topic/workspaces.${workspaceId}.consultation.queue`,
      handleQueueEvent,
    );

    return () => {
      unsubscribe();
    };
  }, [connectionStatus, handleQueueEvent, subscribe, workspaceId]);

  useEffect(() => {
    if (!activeCustomerId) {
      setMatchedWorkflow(null);
      setIsMatchedWorkflowLoading(false);
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
    };
  }, []);

  useEffect(() => {
    if (!activeCustomerId) {
      pendingIdsRef.current.clear();
      setMessages([]);
      setMessagesCustomerId(null);
      setSelectedMessageId(null);
      return;
    }

    pendingIdsRef.current.clear();
    setMessages([]);
    setMessagesCustomerId(null);
    setSelectedMessageId(null);

    let cancelled = false;

    const loadMessages = async () => {
      try {
        const msgs = await consultationApi.getMessages(Number(activeCustomerId));
        if (cancelled) return;
        setMessages(msgs.map(toUiMessage));
        setMessagesCustomerId(activeCustomerId);
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
  }, [activeCustomerId]);

  useEffect(() => {
    if (connectionStatus !== "CONNECTED" || !activeCustomerId) return;

    const topic = `/topic/chat.${activeCustomerId}`;
    const sessionIdForFetch = Number(activeCustomerId);
    const unsubscribe = subscribe(topic, (raw) => {
      const msg = raw as RealtimeChatMessage;
      const normalizedRole = normalizeChatSenderRole(msg.senderRole);
      if (normalizedRole === "ASSISTANT" || normalizedRole === "SYSTEM") {
        if (workflowRefetchTimerRef.current) {
          clearTimeout(workflowRefetchTimerRef.current);
        }
        workflowRefetchTimerRef.current = setTimeout(() => {
          workflowRefetchTimerRef.current = null;
          void loadMatchedWorkflow(sessionIdForFetch).then((workflow) => {
            if (activeCustomerIdRef.current === String(sessionIdForFetch)) {
              setMatchedWorkflow(workflow);
            }
          });
        }, 300);
      }
      if (
        normalizedRole === "COUNSELOR" ||
        normalizedRole === "AGENT" ||
        normalizedRole === "NOTE"
      ) {
        setMessagesCustomerId(activeCustomerId);
        setMessages((prev) => {
          const temps = [...pendingIdsRef.current];
          if (temps.length > 0) {
            const matchIdx = temps.findIndex((id) => {
              const pending = prev.find((m) => m.id === id);
              return pending?.content === (msg.content ?? "");
            });
            if (matchIdx < 0) return prev;
            const tempId = temps[matchIdx];
            pendingIdsRef.current.delete(tempId);
            return prev.map((m) => (m.id === tempId ? toUiMessage(msg) : m));
          }
          return prev;
        });
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
  }, [connectionStatus, activeCustomerId, subscribe, loadMatchedWorkflow]);

  const handleSelectCustomer = useCallback(
    async (id: string) => {
      setActiveCustomerId(id);
      setSelectedMessageId(null);
      setQueue((prev) =>
        prev.map((customer) => (customer.id === id ? { ...customer, hasUnread: false } : customer)),
      );

      const selected = queue.find((customer) => customer.id === id);
      if (!selected || !currentCounselorId || selected.assignedCounselorId) return;

      try {
        const assignedSession = await consultationApi.assignSession(Number(id), currentCounselorId);
        setQueue((prev) =>
          sortQueueCustomers(
            prev.map((customer) =>
              customer.id === id
                ? toQueueCustomer(assignedSession, currentCounselorId, customer)
                : customer,
            ),
          ),
        );
        toast.success("상담 세션이 배정되었습니다.");
      } catch {
        toast.error("상담 세션 배정에 실패했습니다.");
      }
    },
    [currentCounselorId, queue],
  );

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
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setMessagesCustomerId(targetId);
      pendingIdsRef.current.add(optimisticMsg.id);
      setSelectedMessageId(null);

      sendTo("/app/chat.counselor.send", {
        sessionId: Number(targetId),
        content,
        isNote,
      });
    },
    [activeCustomerId, connectionStatus, isAssignedToCurrentCounselor, sendTo],
  );

  const handleEndSession = async () => {
    if (!activeCustomerId || !isAssignedToCurrentCounselor) return;
    const endedSessionId = activeCustomerId;
    try {
      await consultationApi.updateStatus(Number(endedSessionId), "COMPLETED");
      toast.success("상담이 종료되었습니다.");
      setQueue((prev) => prev.filter((customer) => customer.id !== endedSessionId));
      clearActiveConversation();
    } catch {
      toast.error("세션 종료 실패");
    }
  };

  const handleReleaseAssignment = async () => {
    if (!activeCustomerId || !currentCounselorId || !isAssignedToCurrentCounselor) return;
    const releasedSessionId = activeCustomerId;

    try {
      const releasedSession = await consultationApi.releaseSession(
        Number(releasedSessionId),
        currentCounselorId,
      );
      setQueue((prev) =>
        sortQueueCustomers(
          prev.map((customer) =>
            customer.id === releasedSessionId
              ? toQueueCustomer(releasedSession, currentCounselorId, customer)
              : customer,
          ),
        ),
      );
      toast.success("상담 배정이 해제되었습니다.");
      clearActiveConversation();
    } catch (error) {
      console.error("Failed to release session:", error);
      toast.error("상담 배정 해제에 실패했습니다.");
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
          onSelectCustomer={handleSelectCustomer}
          isLoading={isQueueLoading}
          loadError={queueLoadError}
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
                    {activeCustomer.channel ?? ""} · {activeCustomer.waitMinutes}분 대기 중
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
              <button
                className={styles.linkButton}
                onClick={handleReleaseAssignment}
                disabled={!isAssignedToCurrentCounselor}
              >
                배정 해제
              </button>
              <button
                onClick={handleEndSession}
                className={styles.dangerButton}
                disabled={!isAssignedToCurrentCounselor}
              >
                상담 종료
              </button>
            </div>
          </div>
        )}

        <div className={styles.chatPanelSlot}>
          <ChatPanel
            sessionId={activeCustomerId}
            customerName={activeCustomer ? activeCustomerName : null}
            channel={activeCustomer?.channel || null}
            messages={visibleMessages}
            onSendMessage={handleSendMessage}
            selectedMessageId={selectedMessageId}
            onSelectMessage={setSelectedMessageId}
            sessionStatusLabel={activeAssignment?.label}
            sessionStatusDescription={activeAssignment?.description}
            disabled={!isAssignedToCurrentCounselor}
          />
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
                    }
                  : null
              }
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
    </div>
  );
};
