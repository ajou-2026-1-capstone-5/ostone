import type { ReactNode } from "react";

export type PillTone = "signal" | "warn" | "danger" | "info" | "mute" | "ink";

const PILL_STYLE_MAP: Record<PillTone, { bg: string; color: string }> = {
  signal: { bg: "var(--signal-bg)", color: "var(--signal-ink)" },
  warn: { bg: "var(--warn-bg)", color: "var(--warn)" },
  danger: { bg: "var(--danger-bg)", color: "var(--danger)" },
  info: { bg: "var(--info-bg)", color: "var(--info)" },
  mute: { bg: "var(--paper-2)", color: "var(--ink-3)" },
  ink: { bg: "var(--ink)", color: "var(--paper)" },
};

interface PillProps {
  tone: PillTone;
  children: ReactNode;
  className?: string;
}

export function Pill({ tone, children, className }: PillProps) {
  const style = PILL_STYLE_MAP[tone] ?? PILL_STYLE_MAP.mute;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "var(--r-2)",
        fontFamily: "var(--mono)",
        fontSize: "10px",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        fontWeight: 500,
        background: style.bg,
        color: style.color,
      }}
    >
      {children}
    </span>
  );
}
