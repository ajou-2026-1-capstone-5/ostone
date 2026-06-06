import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { toast } from "sonner";
import type { ShellContext } from "@/shared/ui/ostone/chrome";
import { Mono } from "@/shared/ui/ostone/atoms";
import { getAuthUser } from "@/shared/lib/auth";
import { useIsBelow } from "@/shared/hooks/use-media-query";
import { QueuePanel } from "../../../features/consultation/ui/QueuePanel";
import type {
  ChatComposerDraft,
  ChatMessage as UiChatMessage,
} from "../../../features/consultation/ui/ChatPanel";
import { normalizeChatSenderRole } from "../../../features/consultation/lib/chatRoleLabels";
import { sortMessagesByServerOrder } from "../../../features/consultation/lib/messageOrder";
import { consultationApi } from "../../../features/consultation/api/consultationApi";
import {
  consultationEvidenceApi,
  type MessageDomainPackElements,
} from "../../../features/consultation/api/consultationEvidenceApi";
import type {
  ConsultationMetrics,
  ConsultationQueueEvent,
  ResolutionOutcome,
} from "../../../features/consultation/api/consultationApi";
import {
  getCurrentWorkflow,
  type MatchedWorkflow,
} from "../../../features/consultation/api/llmToolWorkflowApi";
import { ConsultationConversationPane } from "./sections/ConsultationConversationPane";
import { ConsultationDetailPane } from "./sections/ConsultationDetailPane";
import { ConsultationStatusRight } from "./sections/ConsultationStatusRight";
import {
  COUNSELOR_MESSAGE_ACK_TIMEOUT_MS,
  EMPTY_COMPOSER_DRAFT,
  MESSAGE_PAGE_SIZE,
  RESOLUTION_OUTCOME_OPTIONS,
  dedupePrependMessages,
  findResolutionOutcomeOption,
  formatTime,
  getAssignmentView,
  getClaimSessionErrorMessage,
  getComposerDraftReleaseWarning,
  getResponseStatusLabel,
  isCounselorEchoRole,
  isCustomerMessageRole,
  markMessageSending,
  mergeMessagesById,
  reconcileCounselorEchoMessage,
  replaceAssignedQueueCustomer,
  shouldRefreshMatchedWorkflow,
  sortQueueCustomers,
  toQueueCustomer,
  toUiMessage,
  type EndSessionModalState,
  type MessagePaginationState,
  type MetricsViewState,
  type PendingMessage,
  type QueueCustomerWithPanelData,
  type RealtimeChatMessage,
  type ReleaseAssignmentModalState,
} from "./model/consultationPageState";
import { useConsultationRealtime } from "./model/useConsultationRealtime";
import styles from "./consultation-page.module.css";

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
  const isNarrowLayout = useIsBelow(1180);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [messageDomainPackElements, setMessageDomainPackElements] =
    useState<MessageDomainPackElements>();

  // 좁은 화면에서 메시지를 선택하면 컨텍스트 슬라이드오버를 자동으로 연다. 패널 닫기는
  // selectedMessageId를 건드리지 않으므로 닫기→재오픈 루프가 발생하지 않는다.
  useEffect(() => {
    if (isNarrowLayout && selectedMessageId) setIsContextOpen(true);
  }, [isNarrowLayout, selectedMessageId]);
  const [isMessageDomainPackElementsLoading, setIsMessageDomainPackElementsLoading] =
    useState(false);
  const [messageDomainPackElementsError, setMessageDomainPackElementsError] = useState<
    string | null
  >(null);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [queueLoadError, setQueueLoadError] = useState<string | null>(null);
  const [matchedWorkflow, setMatchedWorkflow] = useState<MatchedWorkflow | null>(null);
  const [isMatchedWorkflowLoading, setIsMatchedWorkflowLoading] = useState(false);
  const [isDraftResponseLoading, setIsDraftResponseLoading] = useState(false);
  const [endSessionModal, setEndSessionModal] = useState<EndSessionModalState>({ open: false });
  const [releaseAssignmentModal, setReleaseAssignmentModal] = useState<ReleaseAssignmentModalState>(
    { open: false },
  );
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
  const metricsErrorToastShownRef = useRef(false);
  const metricsRequestIdRef = useRef(0);
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
  const activeResponseStatusLabel = activeCustomer
    ? getResponseStatusLabel(activeCustomer.status, activeCustomer.assignedCounselorId)
    : null;

  const clearActiveConversation = useCallback(() => {
    setActiveCustomerId(null);
    setSelectedMessageId(null);
    setMessages([]);
    setMessagesCustomerId(null);
    setMessagePagination({ nextPage: 0, totalPages: 0, isLoadingPrevious: false });
    setMessageDomainPackElements(undefined);
    setIsMessageDomainPackElementsLoading(false);
    setMessageDomainPackElementsError(null);
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
    setTopbarRight(
      <ConsultationStatusRight
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

  const loadMetrics = useCallback(
    async (options: { resetErrorToast?: boolean } = {}) => {
      if (!workspaceId) {
        metricsRequestIdRef.current += 1;
        setMetrics(null);
        setMetricsError(null);
        setIsMetricsLoading(false);
        return null;
      }

      const requestId = metricsRequestIdRef.current + 1;
      metricsRequestIdRef.current = requestId;
      if (options.resetErrorToast) {
        metricsErrorToastShownRef.current = false;
      }
      setIsMetricsLoading(true);
      setMetricsError(null);

      try {
        const data = await consultationApi.getMetrics(workspaceId);
        if (metricsRequestIdRef.current !== requestId) return null;
        setMetrics(data);
        setMetricsError(null);
        return data;
      } catch (error) {
        if (metricsRequestIdRef.current !== requestId) return null;
        console.error("Failed to load consultation metrics:", error);
        setMetrics(null);
        setMetricsError("상담 지표를 불러오지 못했습니다.");
        if (!metricsErrorToastShownRef.current) {
          metricsErrorToastShownRef.current = true;
          toast.error("상담 지표를 불러오지 못했습니다.");
        }
        return null;
      } finally {
        if (metricsRequestIdRef.current === requestId) {
          setIsMetricsLoading(false);
        }
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    void loadMetrics({ resetErrorToast: true });

    return () => {
      metricsRequestIdRef.current += 1;
    };
  }, [loadMetrics]);

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
        const loadedMessages = sortMessagesByServerOrder(messagePage.content.map(toUiMessage));
        setMessages((prev) => mergeMessagesById(prev, loadedMessages));
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

  useEffect(() => {
    if (!activeCustomerId || !selectedMessage) {
      setMessageDomainPackElements(undefined);
      setIsMessageDomainPackElementsLoading(false);
      setMessageDomainPackElementsError(null);
      return;
    }

    const sessionId = Number(activeCustomerId);
    const messageId = Number(selectedMessage.id);
    if (!Number.isInteger(sessionId) || !Number.isInteger(messageId)) {
      setMessageDomainPackElements({ slots: [], policies: [], risks: [] });
      setIsMessageDomainPackElementsLoading(false);
      setMessageDomainPackElementsError(null);
      return;
    }

    let cancelled = false;
    setMessageDomainPackElements(undefined);
    setIsMessageDomainPackElementsLoading(true);
    setMessageDomainPackElementsError(null);

    const routeWorkspaceId =
      workspaceId ?? (workspacePathId ? Number.parseInt(workspacePathId, 10) : null);
    void consultationEvidenceApi
      .getMessageDomainPackElements(
        sessionId,
        messageId,
        routeWorkspaceId
          ? {
              workspaceId: routeWorkspaceId,
              packId: matchedWorkflow?.domainPackId ?? null,
              versionId: matchedWorkflow?.domainPackVersionId ?? null,
            }
          : null,
      )
      .then((elements) => {
        if (cancelled) return;
        setMessageDomainPackElements(elements);
        setMessageDomainPackElementsError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load message domain pack elements:", error);
        setMessageDomainPackElements({ slots: [], policies: [], risks: [] });
        setMessageDomainPackElementsError(
          "상담은 계속 진행할 수 있습니다. 잠시 후 메시지를 다시 선택해 주세요.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsMessageDomainPackElementsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCustomerId, matchedWorkflow, selectedMessage, workspaceId, workspacePathId]);

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

  const handleChatMessage = useCallback(
    (raw: unknown, sessionId: string) => {
      const msg = raw as RealtimeChatMessage;
      const normalizedRole = normalizeChatSenderRole(msg.senderRole);
      if (shouldRefreshMatchedWorkflow(normalizedRole)) {
        scheduleMatchedWorkflowRefresh(Number(sessionId));
      }
      if (isCounselorEchoRole(normalizedRole)) {
        setMessagesCustomerId(sessionId);
        setMessages((prev) =>
          reconcileCounselorEchoMessage(
            prev,
            pendingMessagesRef.current,
            sessionId,
            normalizedRole,
            msg,
          ),
        );
        return;
      }
      const msgId = String(msg.id);
      setMessagesCustomerId(sessionId);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msgId)) return prev;
        return sortMessagesByServerOrder([...prev, toUiMessage(msg)]);
      });
    },
    [scheduleMatchedWorkflowRefresh],
  );

  const handleRealtimeReconnect = useCallback(() => {
    void loadQueue();
  }, [loadQueue]);

  const handleChatUnsubscribe = useCallback(() => {
    if (workflowRefetchTimerRef.current) {
      clearTimeout(workflowRefetchTimerRef.current);
      workflowRefetchTimerRef.current = null;
    }
  }, []);

  const { connectionStatus, sendTo } = useConsultationRealtime({
    workspaceId,
    activeCustomerId,
    hasQueueLoaded,
    onQueueEvent: handleQueueEvent,
    onChatMessage: handleChatMessage,
    onServerError: handleServerError,
    onReconnect: handleRealtimeReconnect,
    onChatUnsubscribe: handleChatUnsubscribe,
  });

  const queueSyncNotice =
    workspaceId && connectionStatus !== "CONNECTED"
      ? "실시간 연결이 불안정합니다. 복구되면 대기열을 다시 동기화합니다."
      : null;

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
      void loadMetrics();
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

      <ConsultationConversationPane
        activeCustomer={activeCustomer}
        activeCustomerId={activeCustomerId}
        activeCustomerName={activeCustomerName}
        activeCustomerInitial={activeCustomerInitial}
        activeResponseStatusLabel={activeResponseStatusLabel}
        activeAssignment={activeAssignment}
        currentCounselorId={currentCounselorId}
        isActiveSessionUnassigned={isActiveSessionUnassigned}
        isActiveSessionClosed={isActiveSessionClosed}
        isClaimingActiveSession={isClaimingActiveSession}
        isAssignedToCurrentCounselor={isAssignedToCurrentCounselor}
        messageInputDisabledReason={messageInputDisabledReason}
        urlSessionUnavailable={urlSessionUnavailable}
        visibleMessages={visibleMessages}
        selectedMessageId={selectedMessageId}
        hasPreviousMessages={hasPreviousMessages}
        messagePagination={messagePagination}
        matchedWorkflow={matchedWorkflow}
        isDraftResponseLoading={isDraftResponseLoading}
        activeComposerDraft={activeComposerDraft}
        onClaimSession={handleClaimSession}
        onOpenReleaseAssignment={handleOpenReleaseAssignment}
        onOpenEndSession={handleOpenEndSession}
        onSendMessage={handleSendMessage}
        onRetryMessage={handleRetryMessage}
        onSelectMessage={setSelectedMessageId}
        onLoadPreviousMessages={handleLoadPreviousMessages}
        onInsertDraftResponse={handleInsertDraftResponse}
        onComposerDraftChange={(draft) => {
          if (!activeCustomerId) return;
          setComposerDrafts((prev) => ({ ...prev, [activeCustomerId]: draft }));
        }}
        onOpenContext={() => setIsContextOpen(true)}
      />

      <ConsultationDetailPane
        activeCustomer={activeCustomer}
        activeCustomerId={activeCustomerId}
        activeCustomerName={activeCustomerName}
        selectedMessage={selectedMessage}
        matchedWorkflow={matchedWorkflow}
        isMatchedWorkflowLoading={isMatchedWorkflowLoading}
        messageDomainPackElements={messageDomainPackElements}
        isMessageDomainPackElementsLoading={isMessageDomainPackElementsLoading}
        messageDomainPackElementsError={messageDomainPackElementsError}
        memo={activeCustomerId ? memos[activeCustomerId] || "" : ""}
        onMemoChange={(val) => {
          if (activeCustomerId) {
            setMemos((prev) => ({ ...prev, [activeCustomerId]: val }));
          }
        }}
        onMemoSave={isAssignedToCurrentCounselor ? handleSaveMemo : undefined}
        onOpenDomainPackElement={(path) => navigate(path)}
        onCloseMessageDetail={() => setSelectedMessageId(null)}
        isNarrow={isNarrowLayout}
        isOpen={isContextOpen}
        onClose={() => setIsContextOpen(false)}
      />

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
