import type { AvatarTone } from "@/shared/ui/ostone/atoms";
import { Avatar, Mono, Icon } from "@/shared/ui/ostone/atoms";

export type MessageVariant = "customer" | "bot" | "agent";

export interface MessageProps {
  variant: MessageVariant;
  name: string;
  time: string;
  text: string;
}

export function Message({ variant, name, time, text }: MessageProps) {
  const isRight = variant === "bot" || variant === "agent";
  const displayName = name?.trim() || "Unknown";

  let avatarInitial: string;
  let avatarTone: AvatarTone;
  let bodyBg: string;
  let bodyBorder: string | undefined;

  if (variant === "customer") {
    avatarInitial = displayName.charAt(0);
    avatarTone = "warn";
    bodyBg = "var(--paper-2)";
    bodyBorder = undefined;
  } else if (variant === "bot") {
    avatarInitial = "◎";
    avatarTone = "signal";
    bodyBg = "var(--paper-2)";
    bodyBorder = "1px dashed var(--line)";
  } else {
    avatarInitial = "강";
    avatarTone = "info";
    bodyBg = "var(--signal-bg)";
    bodyBorder = undefined;
  }

  return (
    <div
      data-msg={variant}
      style={{
        display: "flex",
        flexDirection: isRight ? "row-reverse" : "row",
        gap: 10,
        maxWidth: "70%",
        alignSelf: isRight ? "flex-end" : "flex-start",
      }}
    >
      <Avatar initial={avatarInitial} tone={avatarTone} />
      <div>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "baseline",
            marginBottom: 4,
            justifyContent: isRight ? "flex-end" : "flex-start",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
            {displayName}
          </span>
          <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>{time}</Mono>
        </div>
        <div
          style={{
            padding: "9px 13px",
            borderRadius: "var(--r-3)",
            fontSize: 13,
            lineHeight: 1.5,
            background: bodyBg,
            border: bodyBorder,
            color: "var(--ink)",
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

export function HandoffDivider({ time = "14:24" }: { time?: string }) {
  return (
    <div style={{ padding: "14px 0", display: "flex", alignItems: "center" }}>
      <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-pill)",
          padding: "3px 12px",
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--ink-3)",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: "var(--ink-3)", display: "inline-flex" }}>
          <Icon name="flow" size={12} />
        </span>
        상담사에게 연결됨 · {time}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}
