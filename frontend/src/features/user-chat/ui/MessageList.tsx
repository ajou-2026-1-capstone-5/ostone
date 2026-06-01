import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { ChatMessage } from "@/entities/chat";
import styles from "./MessageList.module.css";

export interface MessageListProps {
  messages: ChatMessage[];
  loading?: boolean;
  error?: string | null;
  botTyping?: boolean;
}

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function resolveSenderName(message: ChatMessage): string {
  if (message.senderName) return message.senderName;
  if (message.senderType === "USER") return "사용자";
  if (message.senderType === "AGENT") return "상담사";
  return "봇";
}

const STATE_CONTAINER_BASE = {
  height: "100%",
  minHeight: 0,
  overflowY: "auto" as const,
  background: "var(--paper-2)",
  padding: "32px 24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export function MessageList({
  messages,
  loading = false,
  error = null,
  botTyping = false,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, botTyping]);

  if (error) {
    return (
      <div style={STATE_CONTAINER_BASE} data-testid="message-list-error">
        <div
          style={{
            padding: "12px 18px",
            borderRadius: 8,
            border: "1px solid var(--danger)",
            background: "var(--danger-bg)",
            color: "var(--danger)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{ ...STATE_CONTAINER_BASE, color: "var(--ink-3)" }}
        data-testid="message-list-loading"
      >
        <Loader2 className="animate-spin" aria-hidden="true" size={14} style={{ marginRight: 8 }} />
        <span style={{ fontSize: 13 }}>메시지를 불러오는 중입니다...</span>
      </div>
    );
  }

  if (messages.length === 0 && !botTyping) {
    return (
      <div
        style={{ ...STATE_CONTAINER_BASE, color: "var(--ink-3)" }}
        data-testid="message-list-empty"
      >
        <span style={{ fontSize: 13 }}>아직 메시지가 없습니다. 첫 메시지를 보내보세요!</span>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        overflowY: "auto",
        background: "var(--paper-2)",
        padding: "18px 20px",
      }}
      data-testid="message-list"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {messages.map((message) => {
          if (message.senderType === "SYSTEM") {
            return (
              <div
                key={message.id}
                data-testid={`message-${message.id}`}
                data-sender="system"
                role="status"
                style={{
                  alignSelf: "center",
                  maxWidth: "82%",
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: "var(--paper-3)",
                  border: "1px solid var(--line)",
                  color: "var(--ink-3)",
                  fontSize: 12,
                  lineHeight: 1.5,
                  textAlign: "center",
                  letterSpacing: "-0.1px",
                }}
              >
                {message.content}
              </div>
            );
          }
          const isUser = message.senderType === "USER";
          const sender = isUser ? "user" : "bot";
          return (
            <div
              key={message.id}
              data-testid={`message-${message.id}`}
              data-sender={sender}
              style={{
                maxWidth: "72%",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                alignSelf: isUser ? "flex-end" : "flex-start",
                alignItems: isUser ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ink-3)",
                }}
              >
                {isUser ? (
                  <>
                    <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                    <span>{resolveSenderName(message)}</span>
                  </>
                ) : (
                  <>
                    <span>{resolveSenderName(message)}</span>
                    <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                  </>
                )}
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  letterSpacing: "-0.12px",
                  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 14px rgba(15, 23, 42, 0.06)",
                  ...(isUser
                    ? {
                        background: "var(--paper)",
                        color: "var(--ink)",
                        border: "1px solid var(--line)",
                        borderBottomRightRadius: 4,
                      }
                    : {
                        background: "var(--ink)",
                        color: "var(--paper)",
                        borderBottomLeftRadius: 4,
                      }),
                }}
              >
                {message.content}
              </div>
            </div>
          );
        })}
        {botTyping ? (
          <div
            data-testid="bot-typing-indicator"
            data-sender="bot"
            style={{
              maxWidth: "72%",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              alignSelf: "flex-start",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--ink-3)",
              }}
            >
              <span>봇</span>
            </div>
            <div
              aria-label="봇이 응답을 입력하는 중입니다"
              role="status"
              style={{
                minWidth: 54,
                height: 34,
                padding: "0 14px",
                borderRadius: 12,
                borderBottomLeftRadius: 4,
                background: "var(--ink)",
                color: "var(--paper)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 14px rgba(15, 23, 42, 0.06)",
              }}
            >
              <span className={styles.typingDot} aria-hidden="true" />
              <span className={styles.typingDot} aria-hidden="true" />
              <span className={styles.typingDot} aria-hidden="true" />
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
