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
import { consultationApi } from "../../../features/consultation/api/consultationApi";
import type {
  ChatSession,
  ConsultationQueueEvent,
} from "../../../features/consultation/api/consultationApi";
import { CustomerPanel } from "./sections/CustomerPanel";
import { MessageDetailPanel } from "../../../features/consultation/ui/MessageDetailPanel";
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

const normalizeSenderRole = (senderRole?: string | null): UiChatMessage["senderRole"] => {
  if (senderRole === "USER") return "CUSTOMER";
  if (
    senderRole === "CUSTOMER" ||
    senderRole === "AGENT" ||
    senderRole === "SYSTEM" ||
    senderRole === "NOTE" ||
    senderRole === "COUNSELOR" ||
    senderRole === "ASSISTANT"
  ) {
    return senderRole;
  }
  return "SYSTEM";
};

const toUiMessage = (message: MessageLike): UiChatMessage => {
  const createdAt = message.createdAt ?? message.timestamp ?? new Date().toISOString();
  return {
    id: String(message.id ?? `message-${createdAt}-${message.content ?? ""}`),
    senderRole: normalizeSenderRole(message.senderRole),
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

const parseSessionMeta = (metaJson?: string | null) => {
  let meta = { customerName: "Unknown", handoffReason: "" };
  try {
    if (metaJson) meta = JSON.parse(metaJson);
  } catch (e) {
    console.error("Failed to parse metaJson", e);
  }
  return meta;
};

const getSessionStatusLabel = (
  status?: string | null,
  assignedCounselorId?: number | null,
  currentCounselorId?: number | null,
) => {
  if (status === "COMPLETED") return "상담 종료";
  if (status === "RESOLVED") return "해결됨";
  if (assignedCounselorId && assignedCounselorId === currentCounselorId) return "내 상담 진행중";
  if (assignedCounselorId) return "상담 진행중";
  if (status === "ACTIVE") return "상담 진행중";
  if (status === "OPEN") return "대기중";
  return status ?? "상태 미확인";
};

const toQueueCustomer = (
  session: ChatSession,
  currentCounselorId: number | null,
  previous?: QueueCustomer,
): QueueCustomer => {
  const meta = parseSessionMeta(session.metaJson);
  const assignedCounselorId =
    session.assignedCounselorId !== undefined
      ? session.assignedCounselorId
      : (previous?.assignedCounselorId ?? null);
  const status = session.status !== undefined ? session.status : (previous?.status ?? null);
  const startedAt = session.startedAt ?? previous?.startedAt ?? null;

  return {
    id: String(session.id ?? previous?.id ?? ""),
    name: meta.customerName?.trim() || previous?.name || "Unknown",
    channel: session.channel ?? previous?.channel ?? "",
    handoffReason: meta.handoffReason ?? previous?.handoffReason ?? "",
    waitMinutes: startedAt ? calcWaitMinutes(startedAt) : (previous?.waitMinutes ?? 0),
    hasUnread: previous?.hasUnread ?? false,
    status,
    statusLabel: getSessionStatusLabel(status, assignedCounselorId, currentCounselorId),
    assignedCounselorId,
    startedAt,
  };
};

const sortQueueCustomers = (customers: QueueCustomer[]) =>
  [...customers].sort((a, b) => {
    const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    return bTime - aTime;
  });

const StatusRight = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Dot tone="signal" />
      <span style={{ fontSize: 12 }}>응대 가능</span>
    </div>
    <div style={{ width: 1, height: 16, background: "var(--line)" }} />
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>평균 첫응답</Mono>
      <span style={{ fontSize: 14, fontWeight: 700 }}>2분</span>
      <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>14초</Mono>
    </div>
    <div style={{ width: 1, height: 16, background: "var(--line)" }} />
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>오늘 처리</Mono>
      <span style={{ fontSize: 14, fontWeight: 700 }}>14건</span>
    </div>
  </div>
);

export const ConsultationPage: React.FC = () => {
  const { setTopbarRight, setCrumbs, workspace } = useOutletContext<ShellContext>();
  const workspaceId = typeof workspace?.id === "number" ? workspace.id : null;
  const [queue, setQueue] = useState<QueueCustomer[]>([]);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [messagesCustomerId, setMessagesCustomerId] = useState<string | null>(null);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [queueLoadError, setQueueLoadError] = useState<string | null>(null);
  const { connectionStatus, subscribe, sendTo } = useStomp();
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const tempCounterRef = useRef(0);
  const activeCustomerIdRef = useRef<string | null>(null);
  const currentCounselorId = getAuthUser()?.id ?? null;

  const activeCustomer = queue.find((c) => c.id === activeCustomerId) || null;
  const activeCustomerName = activeCustomer?.name?.trim() || "Unknown";
  const activeCustomerInitial = activeCustomerName.charAt(0) || "?";
  const visibleMessages =
    activeCustomer && messagesCustomerId === activeCustomer.id ? messages : [];
  const selectedMessage = visibleMessages.find((m) => m.id === selectedMessageId) || null;
  const activeStatusLabel = activeCustomer
    ? getSessionStatusLabel(activeCustomer.status, activeCustomer.assignedCounselorId, currentCounselorId)
    : undefined;
  const isAssignedToCurrentCounselor =
    !!activeCustomer?.assignedCounselorId &&
    activeCustomer.assignedCounselorId === currentCounselorId;

  const clearActiveConversation = useCallback(() => {
    setActiveCustomerId(null);
    setSelectedMessageId(null);
    setMessages([]);
    setMessagesCustomerId(null);
    pendingIdsRef.current.clear();
  }, []);

  useEffect(() => {
    activeCustomerIdRef.current = activeCustomerId;
  }, [activeCustomerId]);

  useEffect(() => {
    setTopbarRight(<StatusRight />);
    setCrumbs(["CARD-CS", "실시간 상담"]);
    return () => {
      setTopbarRight(undefined);
      setCrumbs([]);
    };
  }, [setTopbarRight, setCrumbs]);

  const loadQueue = useCallback(async () => {
    if (!workspaceId) {
      setQueue([]);
      setIsQueueLoading(false);
      setQueueLoadError(null);
      clearActiveConversation();
      return;
    }

    setIsQueueLoading(true);
    setQueueLoadError(null);

    try {
      const sessions = await consultationApi.getQueue(workspaceId);
      const formattedQueue = (Array.isArray(sessions) ? sessions : []).map((s) =>
        toQueueCustomer(s, currentCounselorId),
      );
      setQueue(sortQueueCustomers(formattedQueue));
    } catch (error) {
      console.error("Failed to load queue:", error);
      setQueueLoadError("대기열을 불러오지 못했습니다.");
      toast.error("대기열을 불러오지 못했습니다.");
    } finally {
      setIsQueueLoading(false);
    }
  }, [clearActiveConversation, currentCounselorId, workspaceId]);

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
        const nextCustomer = toQueueCustomer(session, currentCounselorId, previous);
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
    if (connectionStatus === "CONNECTED") return;
    void loadQueue();
  }, [connectionStatus, loadQueue]);

  useEffect(() => {
    if (connectionStatus !== "CONNECTED" || !workspaceId) return;

    void loadQueue();
    const unsubscribe = subscribe(
      `/topic/workspaces.${workspaceId}.consultation.queue`,
      handleQueueEvent,
    );

    return () => {
      unsubscribe();
    };
  }, [connectionStatus, handleQueueEvent, loadQueue, subscribe, workspaceId]);

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
    const unsubscribe = subscribe(topic, (raw) => {
      const msg = raw as RealtimeChatMessage;
      if (msg.senderRole === "COUNSELOR" || msg.senderRole === "NOTE") {
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
    };
  }, [connectionStatus, activeCustomerId, subscribe]);

  const handleSelectCustomer = useCallback(
    async (id: string) => {
      setActiveCustomerId(id);
      setSelectedMessageId(null);

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
      toast.success("상담 메모 저장 요청을 전송했습니다.");
    }
  }, [
    activeCustomerId,
    connectionStatus,
    handleSendMessage,
    isAssignedToCurrentCounselor,
    memos,
  ]);

  return (
    <div className={styles.consultationRoot}>
      <div className={styles.queuePane}>
        <QueuePanel
          customers={queue}
          activeCustomerId={activeCustomerId}
          onSelectCustomer={handleSelectCustomer}
          isLoading={isQueueLoading}
          loadError={queueLoadError}
          onRetry={loadQueue}
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
            customerName={activeCustomer ? activeCustomerName : null}
            channel={activeCustomer?.channel || null}
            messages={visibleMessages}
            onSendMessage={handleSendMessage}
            selectedMessageId={selectedMessageId}
            onSelectMessage={setSelectedMessageId}
            sessionStatusLabel={activeStatusLabel}
            disabled={!isAssignedToCurrentCounselor}
          />
        </div>
      </div>

      <div className={styles.detailPane}>
        {selectedMessage ? (
          // TODO: domainPackElements를 실제 API 응답 데이터로 교체 (별도 API 연동 티켓)
          <MessageDetailPanel message={selectedMessage} onClose={() => setSelectedMessageId(null)} />
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
  );
};
