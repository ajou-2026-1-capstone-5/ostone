import type { DemoChatSession } from "@/entities/chat";
import { MessageInput, MessageList } from "@/features/user-chat";
import { ChatHeader } from "./ChatHeader";

interface ChatConversationScreenProps {
  session: DemoChatSession;
  customerName: string;
  isSending: boolean;
  messageError: string | null;
  onSend: (content: string) => void;
}

export function ChatConversationScreen({
  session,
  customerName,
  isSending,
  messageError,
  onSend,
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
        </div>
        <div>
          {customerName} · {session.messages.length} messages
        </div>
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
