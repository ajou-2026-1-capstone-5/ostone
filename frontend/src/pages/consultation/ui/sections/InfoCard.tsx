import type { CSSProperties, ReactNode } from "react";

interface InfoCardProps {
  title: string;
  meta?: string;
  children: ReactNode;
  testId?: string;
  style?: CSSProperties;
}

export function InfoCard({ title, meta, children, testId, style }: InfoCardProps) {
  return (
    <section
      data-testid={testId ?? `info-card-${slugify(title)}`}
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--r-3)",
        padding: "14px 14px 12px",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 14px rgba(15, 23, 42, 0.06)",
        ...style,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          paddingBottom: 10,
          marginBottom: 10,
          borderBottom: "1px solid var(--line-2)",
        }}
      >
        <h3
          data-testid="info-card-title"
          style={{
            margin: 0,
            fontFamily: "var(--mono)",
            fontSize: 10.5,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--ink-2)",
          }}
        >
          {title}
        </h3>
        {meta !== undefined && (
          <span
            data-testid="info-card-meta"
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {meta}
          </span>
        )}
      </header>
      <div data-testid="info-card-content">{children}</div>
    </section>
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-]/g, "");
}
