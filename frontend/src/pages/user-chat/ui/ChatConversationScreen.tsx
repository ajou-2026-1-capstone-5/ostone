import type { DemoChatSession } from "@/entities/chat";
import { MessageInput, MessageList } from "@/features/user-chat";
import { ChatHeader } from "./ChatHeader";

interface ChatConversationScreenProps {
  session: DemoChatSession;
  customerName: string;
  workspaceId: number;
  isSending: boolean;
  messageError: string | null;
  onSend: (content: string) => void;
  onStartNewSession: () => void;
}

export function ChatConversationScreen({
  session,
  customerName,
  workspaceId,
  isSending,
  messageError,
  onSend,
  onStartNewSession,
}: ChatConversationScreenProps) {
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
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "var(--signal)",
              }}
            />
            연결됨
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
        <MessageList messages={session.messages} />
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
      <MessageInput
        onSend={(content) => {
          onSend(content);
        }}
        disabled={isSending}
      />
    </div>
  );
}
