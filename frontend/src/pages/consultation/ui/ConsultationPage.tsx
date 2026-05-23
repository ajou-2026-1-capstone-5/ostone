import React, { useState, useEffect, useCallback, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import type { ShellContext } from "@/shared/ui/ostone/chrome";
import { Dot, Mono, Pill, Avatar, Eyebrow, Icon } from "@/shared/ui/ostone/atoms";
import { useStomp } from "@/shared/lib/websocket";
import { QueuePanel } from "../../../features/consultation/ui/QueuePanel";
import type { QueueCustomer } from "../../../features/consultation/ui/QueuePanel";
import { ChatPanel } from "../../../features/consultation/ui/ChatPanel";
import type { ChatMessage as UiChatMessage } from "../../../features/consultation/ui/ChatPanel";
import { consultationApi } from "../../../features/consultation/api/consultationApi";
import { CustomerPanel } from "./sections/CustomerPanel";
import { MessageDetailPanel } from "../../../features/consultation/ui/MessageDetailPanel";

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

const calcWaitMinutes = (isoString: string) => {
  if (!isoString) return 0;
  const d = new Date(isoString);
  const diffMs = new Date().getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
};

const SUGGESTIONS = ["부분환불 가능합니다", "환불 처리 중입니다", "카드사 확인이 필요합니다"];

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
  const { setTopbarRight, setCrumbs } = useOutletContext<ShellContext>();
  const [queue, setQueue] = useState<QueueCustomer[]>([]);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const { connectionStatus, subscribe, sendTo } = useStomp<RealtimeChatMessage>();
  const pendingIdsRef = useRef<Set<string>>(new Set());

  const activeCustomer = queue.find((c) => c.id === activeCustomerId) || null;
  const selectedMessage = messages.find((m) => m.id === selectedMessageId) || null;

  useEffect(() => {
    setTopbarRight(<StatusRight />);
    setCrumbs(["CARD-CS", "실시간 상담"]);
    return () => {
      setTopbarRight(undefined);
      setCrumbs([]);
    };
  }, [setTopbarRight, setCrumbs]);

  // Sync selectedMessageId with messages list (e.g., after polling refresh)
  useEffect(() => {
    if (selectedMessageId && !messages.some((m) => m.id === selectedMessageId)) {
      setSelectedMessageId(null);
    }
  }, [messages, selectedMessageId]);

  const loadQueue = useCallback(async () => {
    try {
      const sessions = await consultationApi.getQueue();
      const formattedQueue = sessions.map((s) => {
        let meta = { customerName: "Unknown", handoffReason: "" };
        try {
          if (s.metaJson) meta = JSON.parse(s.metaJson);
        } catch (e) {
          console.error("Failed to parse metaJson", e);
        }
        return {
          id: String(s.id),
          name: meta.customerName,
          channel: s.channel ?? "",
          handoffReason: meta.handoffReason,
          waitMinutes: calcWaitMinutes(s.startedAt ?? ""),
          hasUnread: false,
        };
      });
      setQueue(formattedQueue);
    } catch (error) {
      console.error("Failed to load queue:", error);
      toast.error("대기열을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  useEffect(() => {
    if (!activeCustomerId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const loadMessages = async () => {
      try {
        const msgs = await consultationApi.getMessages(Number(activeCustomerId));
        if (cancelled) return;
        setMessages(
          msgs.map((m) => ({
            id: String(m.id),
            senderRole: m.senderRole as UiChatMessage["senderRole"],
            content: m.content ?? "",
            timestamp: formatTime(m.createdAt ?? ""),
          })),
        );
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

    const topic = `/topic/chat.counselor.${activeCustomerId}`;
    const unsubscribe = subscribe(topic, (msg) => {
      if (msg.senderRole === "COUNSELOR") {
        setMessages((prev) => {
          const temps = [...pendingIdsRef.current];
          if (temps.length > 0) {
            pendingIdsRef.current.delete(temps[0]);
            return prev.map((m) =>
              m.id === temps[0]
                ? { id: String(msg.id), senderRole: "COUNSELOR" as const, content: msg.content ?? "", timestamp: formatTime(msg.createdAt ?? msg.timestamp ?? "") }
                : m,
            );
          }
          return prev;
        });
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: String(msg.id),
          senderRole: msg.senderRole as UiChatMessage["senderRole"],
          content: msg.content ?? "",
          timestamp: formatTime(msg.createdAt ?? msg.timestamp ?? ""),
        },
      ]);
    });

    return () => {
      unsubscribe();
    };
  }, [connectionStatus, activeCustomerId, subscribe]);

  const handleSelectCustomer = (id: string) => {
    setActiveCustomerId(id);
    setSelectedMessageId(null);
    if (!statuses[id]) {
      setStatuses((prev) => ({ ...prev, [id]: "IN_PROGRESS" }));
    }
  };

  const handleSendMessage = useCallback(
    (content: string, isNote: boolean) => {
      if (!activeCustomerId) return;
      if (connectionStatus !== "CONNECTED") {
        toast.error("연결이 불안정합니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      const targetId = activeCustomerId;

      const messagePayload = {
        sessionId: Number(targetId),
        content,
        isNote,
      };

      const optimisticMsg: UiChatMessage = {
        id: `temp-${Date.now()}`,
        senderRole: "COUNSELOR",
        content,
        timestamp: formatTime(new Date().toISOString()),
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      pendingIdsRef.current.add(optimisticMsg.id);
      setSelectedMessageId(null);

      sendTo("/app/chat.counselor.send", messagePayload);
    },
    [activeCustomerId, connectionStatus, sendTo],
  );

  const handleEndSession = async () => {
    if (!activeCustomerId) return;
    try {
      await consultationApi.updateStatus(Number(activeCustomerId), "COMPLETED");
      setStatuses((prev) => ({ ...prev, [activeCustomerId]: "COMPLETED" }));
      toast.success("상담이 종료되었습니다.");
      loadQueue();
      setActiveCustomerId(null);
      setSelectedMessageId(null);
    } catch (err) {
      toast.error("세션 종료 실패");
    }
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <div style={{ width: 268, flexShrink: 0, background: "var(--paper-2)", overflow: "auto" }}>
        <QueuePanel
          customers={queue}
          activeCustomerId={activeCustomerId}
          onSelectCustomer={handleSelectCustomer}
        />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {activeCustomer && (
          <div
            style={{ flexShrink: 0, padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar initial={activeCustomer.name.charAt(0)} tone="warn" size={36} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                    {activeCustomer.name} 고객
                  </div>
                  <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>
                    {activeCustomer.channel ?? ""} · {activeCustomer.waitMinutes}분 대기 중
                  </Mono>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Eyebrow>AI가 분류한 주제</Eyebrow>
                <Pill tone="signal">카드 환불 — 부분환불</Pill>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 12,
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid var(--line-2)",
              }}
            >
              <button
                style={{
                  fontSize: 12,
                  color: "var(--ink-3)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                다른 상담사에게 넘기기
              </button>
              <button
                onClick={handleEndSession}
                style={{
                  fontSize: 12,
                  color: "var(--danger)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                상담 종료
              </button>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto" }}>
          <ChatPanel
            customerName={activeCustomer?.name || null}
            channel={activeCustomer?.channel || null}
            messages={messages}
            onSendMessage={handleSendMessage}
            selectedMessageId={selectedMessageId}
            onSelectMessage={setSelectedMessageId}
          />
        </div>

        {activeCustomer && (
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderTop: "1px solid var(--line-2)",
              background: "var(--paper)",
            }}
          >
            <Icon name="spark" size={14} />
            <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>추천 답변</Mono>
            {SUGGESTIONS.map((text) => (
              <button
                key={text}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  background: "var(--paper-3)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-pill)",
                  cursor: "pointer",
                  color: "var(--ink)",
                }}
              >
                {text}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedMessage ? (
        // TODO: domainPackElements를 실제 API 응답 데이터로 교체 (별도 API 연동 티켓)
        <MessageDetailPanel message={selectedMessage} onClose={() => setSelectedMessageId(null)} />
      ) : (
        <CustomerPanel
          customer={
            activeCustomer
              ? {
                  name: activeCustomer.name,
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
        />
      )}
    </div>
  );
};
