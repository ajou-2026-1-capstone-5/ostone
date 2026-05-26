import { useEffect, useState } from "react";
import type { ChatMessage } from "@/entities/chat";
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages([]);
  }, [sessionId]);

  useEffect(() => {
    if (connectionStatus !== "CONNECTED") return;
    const unsubscribe = subscribe(`/topic/chat.${sessionId}`, (raw) => {
      if (!isChatMessage(raw)) return;
      if (raw.sessionId !== sessionId) return;
      setMessages((current) => {
        if (current.some((message) => message.id === raw.id)) return current;
        return [...current, raw];
      });
    });
    return unsubscribe;
  }, [connectionStatus, sessionId, subscribe]);

  return (
    <section className="flex h-full min-h-[520px] flex-col rounded-lg border border-gray-200 bg-white">
      <ConnectionStatus status={connectionStatus} />
      <div className="flex-1 border-y border-gray-100">
        <MessageList messages={messages} />
      </div>
      <MessageInput
        disabled={connectionStatus !== "CONNECTED"}
        onSend={(content) => sendMessage({ sessionId, content })}
      />
    </section>
  );
}
