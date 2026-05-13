import type { DemoChatMessage } from "../model/chatWorkflow.types";

interface ChatTimelinePanelProps {
  messages: DemoChatMessage[];
  selectedMessageId?: string | null;
  onMessageSelect?: (messageId: string) => void;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toISOString().substring(11, 19);
}

export function ChatTimelinePanel({
  messages,
  selectedMessageId,
  onMessageSelect,
}: ChatTimelinePanelProps) {
  return (
    <div className="flex h-full flex-col">
      <h3 className="px-4 py-2 text-sm font-semibold">Chat Timeline</h3>
      <div
        data-scrollable
        className="flex-1 overflow-y-auto px-4"
        style={{ maxHeight: "100%" }}
      >
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            대화 내역이 없습니다.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              data-testid={`chat-message-${msg.id}`}
              onClick={() => onMessageSelect?.(msg.id)}
              className={`mb-2 cursor-pointer rounded-md px-3 py-2 text-sm transition-colors ${
                msg.id === selectedMessageId
                  ? "border-l-2 border-l-blue-500 bg-blue-50"
                  : "bg-muted"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                    msg.role === "user"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {msg.role}
                </span>
                <span className="text-xs text-gray-400">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <p className="mt-1">{msg.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
