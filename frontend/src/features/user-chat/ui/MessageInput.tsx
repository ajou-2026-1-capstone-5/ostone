import { useState } from "react";
import { Send } from "lucide-react";

export interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [content, setContent] = useState("");

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setContent("");
  };

  return (
    <div className="flex gap-3 border-t border-gray-200 bg-white" style={{ padding: "14px 16px" }}>
      <input
        aria-label="메시지 입력"
        className="flex-1 rounded-full border border-gray-300 bg-white text-sm text-black outline-none transition focus:border-black focus:ring-3 focus:ring-black/10 disabled:pointer-events-none disabled:bg-gray-100 disabled:text-gray-500"
        disabled={disabled}
        placeholder="메시지를 입력하세요"
        style={{
          minHeight: 48,
          padding: "0 18px",
        }}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          if (event.nativeEvent.isComposing) return;
          event.preventDefault();
          submit();
        }}
      />
      <button
        type="button"
        aria-label="메시지 보내기"
        className="inline-flex items-center justify-center rounded-full bg-black text-white outline-none transition hover:bg-gray-900 focus:ring-3 focus:ring-black/15 disabled:pointer-events-none disabled:bg-gray-300 disabled:text-white"
        disabled={disabled}
        style={{
          height: 48,
          width: 48,
        }}
        onClick={submit}
      >
        <Send className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
