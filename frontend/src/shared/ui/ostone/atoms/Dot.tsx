export type DotTone = "signal" | "warn" | "danger" | "info" | "mute";

const TONE_MAP: Record<DotTone, string> = {
  signal: "var(--signal)",
  warn: "var(--warn)",
  danger: "var(--danger)",
  info: "var(--info)",
  mute: "var(--ink-4)",
};

interface DotProps {
  tone: DotTone;
  size?: number;
}

export function Dot({ tone, size = 6 }: DotProps) {
  return (
    <span
      style={{
        display: "inline-block",
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: TONE_MAP[tone] ?? TONE_MAP.mute,
      }}
    />
  );
}
