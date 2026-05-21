interface BarProps {
  value: number;
  tone?: "ink" | "signal";
  w?: number;
  h?: number;
}

export function Bar({ value, tone = "ink", w = 80, h = 4 }: BarProps) {
  const fillColor = tone === "signal" ? "var(--signal)" : "var(--ink-2)";
  return (
    <div
      style={{
        width: `${w}px`,
        height: `${h}px`,
        borderRadius: "var(--r-pill)",
        background: "var(--line-2)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${value * 100}%`,
          height: "100%",
          borderRadius: "var(--r-pill)",
          background: fillColor,
        }}
      />
    </div>
  );
}
