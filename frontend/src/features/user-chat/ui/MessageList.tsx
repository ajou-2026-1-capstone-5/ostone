import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { ChatMessage } from "@/entities/chat";

export interface MessageListProps {
  messages: ChatMessage[];
  loading?: boolean;
  error?: string | null;
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

export function MessageList({ messages, loading = false, error = null }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center overflow-y-auto bg-white p-6 text-sm text-black">
        <div className="rounded-lg border border-black px-4 py-3">{error}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center overflow-y-auto bg-white p-6 text-sm text-gray-500">
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
        메시지를 불러오는 중입니다...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center overflow-y-auto bg-white p-6 text-sm text-gray-500">
        아직 메시지가 없습니다. 첫 메시지를 보내보세요!
      </div>
    );
  }

  return (
    <div className="min-h-[400px] overflow-y-auto bg-white p-4">
      <div className="flex flex-col gap-4">
        {messages.map((message) => {
          const isUser = message.senderType === "USER";
          return (
            <div
              key={message.id}
              data-testid={`message-${message.id}`}
              className={`flex ${isUser ? "justify-start" : "justify-end"}`}
            >
              <div className={`max-w-[72%] ${isUser ? "text-left" : "text-right"}`}>
                <div className="mb-1 flex items-baseline gap-2 text-xs text-gray-500">
                  <span>{resolveSenderName(message)}</span>
                  <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                </div>
                <div
                  className={`rounded-lg p-3 text-sm leading-6 ${
                    isUser ? "bg-gray-100 text-black" : "bg-black text-white"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
