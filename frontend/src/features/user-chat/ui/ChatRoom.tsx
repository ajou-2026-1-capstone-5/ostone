import { useEffect, useState } from "react";
import { listChatMessages, type ChatMessage } from "@/entities/chat";
import {
  isChatMessageResponse,
  mergeMessages,
  toChatMessage,
} from "@/entities/chat/lib/chatMessageSync";
import { useStomp } from "@/shared/lib/websocket";
import { ConnectionStatus } from "./ConnectionStatus";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";

export interface ChatRoomProps {
  sessionId: number;
}

function isChatMessage(message: unknown): message is ChatMessage {
  if (!message || typeof message !== "object") return false;

  const candidate = message as Partial<ChatMessage>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.sessionId === "number" &&
    typeof candidate.content === "string" &&
    typeof candidate.createdAt === "string" &&
    (candidate.senderType === "USER" ||
      candidate.senderType === "BOT" ||
      candidate.senderType === "AGENT")
  );
}

export function ChatRoom({ sessionId }: ChatRoomProps) {
  const { connectionStatus, sendMessage, subscribe } = useStomp();
  const [messageState, setMessageState] = useState<{
    sessionId: number;
    messages: ChatMessage[];
    loading: boolean;
    error: string | null;
  }>({ sessionId, messages: [], loading: true, error: null });
  const currentMessageState =
    messageState.sessionId === sessionId
      ? messageState
      : { messages: [], loading: true, error: null };
  const messages = currentMessageState.messages;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const initialMessages = await listChatMessages(sessionId);
        if (!cancelled) {
          setMessageState((current) => {
            const currentMessages = current.sessionId === sessionId ? current.messages : [];
            return {
              sessionId,
              messages: mergeMessages(currentMessages, initialMessages),
              loading: false,
              error: null,
            };
          });
        }
      } catch {
        if (!cancelled) {
          setMessageState({
            sessionId,
            messages: [],
            loading: false,
            error: "메시지를 불러오지 못했습니다.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (connectionStatus !== "CONNECTED") return;
    const unsubscribe = subscribe(`/topic/chat.${sessionId}`, (raw) => {
      const nextMessage = isChatMessageResponse(raw)
        ? toChatMessage(raw, sessionId)
        : isChatMessage(raw) && raw.sessionId === sessionId
          ? raw
          : null;
      if (!nextMessage) return;
      setMessageState((current) => {
        const currentMessages = current.sessionId === sessionId ? current.messages : [];
        if (currentMessages.some((message) => message.id === nextMessage.id)) {
          return {
            sessionId,
            messages: currentMessages,
            loading: false,
            error: current.sessionId === sessionId ? current.error : null,
          };
        }
        return {
          sessionId,
          messages: mergeMessages(currentMessages, [nextMessage]),
          loading: false,
          error: current.sessionId === sessionId ? current.error : null,
        };
      });
    });
    return unsubscribe;
  }, [connectionStatus, sessionId, subscribe]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <ConnectionStatus status={connectionStatus} />
      <div className="min-h-0 flex-1 border-y border-gray-100">
        <MessageList
          messages={messages}
          loading={currentMessageState.loading}
          error={currentMessageState.error}
        />
      </div>
      <MessageInput
        disabled={connectionStatus !== "CONNECTED"}
        onSend={(content) => sendMessage({ sessionId, content })}
      />
    </section>
  );
}
