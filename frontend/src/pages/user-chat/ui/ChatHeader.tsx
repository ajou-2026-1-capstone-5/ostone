import { deriveAvatarInitial } from "./deriveAvatarInitial";

interface ChatHeaderProps {
  customerName: string;
  sessionId: string;
  status: string;
}

export function ChatHeader({ customerName, sessionId, status }: ChatHeaderProps) {
  const initial = deriveAvatarInitial(customerName);
  const isOpen = status === "OPEN";
  return (
    <header
      data-testid="chat-header"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "16px 20px",
        background: "var(--paper)",
        borderBottom: "1px solid var(--line-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          aria-hidden="true"
          data-testid="chat-header-avatar"
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            background: "var(--ink)",
            color: "var(--paper)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 540,
          }}
        >
          {initial}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            data-testid="chat-header-eyebrow"
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10.5,
              fontWeight: 480,
              color: "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Session #{sessionId}
          </span>
          <h1
            data-testid="chat-header-name"
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 540,
              letterSpacing: "-0.2px",
              color: "var(--ink)",
              marginTop: 2,
            }}
          >
            {customerName}
          </h1>
        </div>
      </div>
      <span
        data-testid="chat-header-status"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          borderRadius: 999,
          fontFamily: "var(--mono)",
          fontSize: 10.5,
          fontWeight: 540,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          background: isOpen ? "var(--signal-bg)" : "var(--paper-3)",
          color: isOpen ? "var(--signal-ink)" : "var(--ink-3)",
          border: `1px solid ${isOpen ? "var(--signal)" : "var(--line)"}`,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: isOpen ? "var(--signal)" : "var(--ink-3)",
            boxShadow: isOpen ? "0 0 0 3px rgba(34, 197, 94, 0.18)" : undefined,
          }}
        />
        {status}
      </span>
    </header>
  );
}
