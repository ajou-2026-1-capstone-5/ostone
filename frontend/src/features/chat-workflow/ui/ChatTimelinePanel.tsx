import type { ChatMessage } from "../model/chatWorkflow.types";

interface ChatTimelinePanelProps {
  messages: ChatMessage[];
}

export function ChatTimelinePanel({ messages }: ChatTimelinePanelProps) {
  return (
    <div className="flex h-full flex-col">
      <h3 className="px-4 py-2 text-sm font-semibold">Chat Timeline</h3>
      <div data-scrollable className="flex-1 overflow-y-auto px-4" style={{ maxHeight: '100%' }}>
        {messages.map((msg) => (
          <div key={msg.id} className="mb-2 rounded-md bg-muted px-3 py-2 text-sm">
            <strong className="mr-1">{msg.role}:</strong>
            {msg.content}
          </div>
        ))}
      </div>
    </div>
  );
}
