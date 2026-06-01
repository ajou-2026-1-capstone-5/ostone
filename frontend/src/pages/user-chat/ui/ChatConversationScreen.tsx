import type { DemoChatSession } from "@/entities/chat";
import { MessageInput, MessageList } from "@/features/user-chat";
import type { ConnectionStatus } from "@/shared/lib/websocket";
import { ChatHeader } from "./ChatHeader";

interface ChatConversationScreenProps {
  session: DemoChatSession;
  customerName: string;
  workspaceId: number;
  isSending: boolean;
  botTyping?: boolean;
  connectionStatus: ConnectionStatus;
  messageError: string | null;
  onSend: (content: string) => void;
  onStartNewSession: () => void;
}

interface RealtimeConnectionDisplay {
  label: string;
  notice: string | null;
  dotColor: string;
  noticeBorder: string;
  noticeBackground: string;
  noticeColor: string;
  canSend: boolean;
}

function resolveRealtimeConnectionDisplay(status: ConnectionStatus): RealtimeConnectionDisplay {
  if (status === "CONNECTED") {
    return {
      label: "연결됨",
      notice: null,
      dotColor: "var(--signal)",
      noticeBorder: "var(--line-2)",
      noticeBackground: "var(--paper)",
      noticeColor: "var(--ink-3)",
      canSend: true,
    };
  }

  if (status === "CONNECTING") {
    return {
      label: "연결 중",
      notice: "실시간 연결을 준비하는 중입니다. 연결 후 메시지를 보낼 수 있습니다.",
      dotColor: "var(--ink-4)",
      noticeBorder: "var(--line)",
      noticeBackground: "var(--paper-3)",
      noticeColor: "var(--ink-3)",
      canSend: false,
    };
  }

  if (status === "DISCONNECTED") {
    return {
      label: "재연결 중",
      notice: "실시간 연결이 끊어졌습니다. 잠시 후 자동 재연결을 시도합니다.",
      dotColor: "var(--ink-4)",
      noticeBorder: "var(--line)",
      noticeBackground: "var(--paper-3)",
      noticeColor: "var(--ink-3)",
      canSend: false,
    };
  }

  return {
    label: "오프라인",
    notice: "실시간 연결에 문제가 있습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
    dotColor: "var(--danger)",
    noticeBorder: "var(--danger)",
    noticeBackground: "var(--danger-bg)",
    noticeColor: "var(--danger)",
    canSend: false,
  };
}

export function ChatConversationScreen({
  session,
  customerName,
  workspaceId,
  isSending,
  botTyping = false,
  connectionStatus,
  messageError,
  onSend,
  onStartNewSession,
}: ChatConversationScreenProps) {
  const connectionDisplay = resolveRealtimeConnectionDisplay(connectionStatus);
  const isInputDisabled = isSending || !connectionDisplay.canSend;

  return (
    <div
      data-testid="chat-conversation-screen"
      style={{
        display: "flex",
        height: "100vh",
        minHeight: 0,
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--paper-2)",
      }}
    >
      <ChatHeader customerName={customerName} sessionId={session.id} status={session.status} />
      <div
        data-testid="chat-meta-strip"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "8px 20px",
          background: "var(--paper-2)",
          borderBottom: "1px solid var(--line-2)",
          fontFamily: "var(--mono)",
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--ink-3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 0,
            flexWrap: "wrap",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span
              aria-hidden="true"
              data-testid="chat-connection-dot"
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: connectionDisplay.dotColor,
              }}
            />
            {connectionDisplay.label}
          </span>
          <span>Workspace #{workspaceId} · 운영 도메인 팩 기준</span>
        </div>
        <button
          type="button"
          data-testid="chat-new-session-button"
          onClick={onStartNewSession}
          style={{
            minHeight: 30,
            flexShrink: 0,
            padding: "0 12px",
            borderRadius: 999,
            border: "1px solid var(--line)",
            background: "var(--paper)",
            color: "var(--ink)",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: 12.5,
            fontWeight: 540,
            letterSpacing: "-0.12px",
          }}
        >
          새 테스트 세션 시작
        </button>
      </div>
      <div
        data-testid="chat-session-reuse-note"
        style={{
          padding: "7px 20px",
          borderBottom: "1px solid var(--line-2)",
          background: "var(--paper)",
          color: "var(--ink-3)",
          fontSize: 12.5,
          lineHeight: 1.45,
        }}
      >
        같은 이름으로 다시 들어오면 {customerName} 테스트 세션을 이어서 엽니다. 새 테스트 세션
        시작을 누르면 저장된 세션 대신 새 대화를 시작합니다.
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: "var(--paper-2)",
        }}
      >
        <MessageList messages={session.messages} botTyping={botTyping} />
      </div>
      {messageError && (
        <div
          role="alert"
          data-testid="chat-message-error"
          style={{
            borderTop: "1px solid var(--danger)",
            background: "var(--danger-bg)",
            padding: "10px 20px",
            fontSize: 12.5,
            color: "var(--danger)",
            fontWeight: 500,
          }}
        >
          {messageError}
        </div>
      )}
      {connectionDisplay.notice && (
        <div
          role="status"
          data-testid="chat-connection-notice"
          style={{
            borderTop: `1px solid ${connectionDisplay.noticeBorder}`,
            background: connectionDisplay.noticeBackground,
            padding: "9px 20px",
            fontSize: 12.5,
            lineHeight: 1.45,
            color: connectionDisplay.noticeColor,
            fontWeight: 450,
          }}
        >
          {connectionDisplay.notice}
        </div>
      )}
      <MessageInput
        onSend={(content) => {
          onSend(content);
        }}
        disabled={isInputDisabled}
      />
    </div>
  );
}
