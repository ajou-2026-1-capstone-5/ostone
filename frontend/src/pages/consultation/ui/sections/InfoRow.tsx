import type { ReactNode } from "react";

export type InfoRowTone = "default" | "signal" | "warn" | "danger";

const TONE_BORDER: Record<InfoRowTone, string> = {
  default: "var(--line-2)",
  signal: "var(--signal)",
  warn: "var(--warn)",
  danger: "var(--danger)",
};

interface InfoRowProps {
  label: string;
  value: ReactNode;
  tone?: InfoRowTone;
  testId?: string;
}

export function InfoRow({ label, value, tone = "default", testId }: InfoRowProps) {
  return (
    <div
      data-testid={testId}
      data-tone={tone}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 0 6px 10px",
        borderLeft: `2px solid ${TONE_BORDER[tone]}`,
      }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-3)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: "var(--ink)",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}
