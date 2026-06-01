import { useState } from "react";
import { Send } from "lucide-react";
import styles from "./MessageInput.module.css";

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

  const isSendDisabled = disabled || content.trim().length === 0;

  return (
    <form
      data-testid="message-input"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      style={{
        background: "var(--paper)",
        borderTop: "1px solid var(--line-2)",
        padding: "12px 20px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <input
        className={styles.input}
        aria-label="메시지 입력"
        disabled={disabled}
        placeholder="메시지를 입력하세요"
        style={{
          flex: 1,
          height: 42,
          padding: "0 18px",
          borderRadius: 28,
          border: "1px solid var(--line)",
          background: disabled ? "var(--paper-2)" : "var(--paper)",
          color: disabled ? "var(--ink-3)" : "var(--ink)",
          fontSize: 13.5,
          fontWeight: 460,
          fontFamily: "inherit",
          letterSpacing: "-0.12px",
          transition: "border-color 160ms ease, background 160ms ease",
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
        disabled={isSendDisabled}
        style={{
          width: 42,
          height: 42,
          borderRadius: 999,
          background: isSendDisabled ? "var(--paper-3)" : "var(--ink)",
          color: isSendDisabled ? "var(--ink-4)" : "var(--paper)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: isSendDisabled ? "not-allowed" : "pointer",
          transition: "background 160ms ease, color 160ms ease",
        }}
        onClick={submit}
      >
        <Send size={16} aria-hidden="true" />
      </button>
    </form>
  );
}
