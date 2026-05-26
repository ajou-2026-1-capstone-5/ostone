import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface CrumbItem {
  label: string;
  href?: string;
  testId?: string;
}

export type Crumb = string | CrumbItem;

interface TopbarProps {
  crumbs: Crumb[];
  right?: ReactNode;
  left?: ReactNode;
  dark?: boolean;
}

function toItem(c: Crumb): CrumbItem {
  return typeof c === "string" ? { label: c } : c;
}

export function Topbar({ crumbs, right, left, dark = false }: TopbarProps) {
  const bg = dark ? "var(--dark-bg)" : "transparent";
  const borderColor = dark ? "var(--dark-line)" : "var(--line)";
  const ink = dark ? "var(--dark-ink)" : "var(--ink)";
  const ink2 = dark ? "var(--dark-ink-2)" : "var(--ink-2)";

  return (
    <header
      style={{
        height: "44px",
        background: bg,
        borderBottom: `1px solid ${borderColor}`,
        padding: "0 var(--s-5)",
        fontSize: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-2)",
        }}
      >
        <span className="t-eyebrow">OSTONE</span>
        {left && <div style={{ display: "flex", alignItems: "center" }}>{left}</div>}
        {crumbs.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
            {crumbs.map((raw, index) => {
              const crumb = toItem(raw);
              const isLast = index === crumbs.length - 1;
              const color = isLast ? ink : ink2;
              const fontWeight = isLast ? 500 : 400;
              const labelEl =
                crumb.href && !isLast ? (
                  <Link
                    className="crumb"
                    to={crumb.href}
                    data-testid={crumb.testId}
                    style={{
                      color,
                      fontWeight,
                      textDecoration: "none",
                      transition: "color 120ms ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.color = ink;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.color = color;
                    }}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className="crumb"
                    data-testid={crumb.testId}
                    style={{ color, fontWeight }}
                  >
                    {crumb.label}
                  </span>
                );
              return (
                <div
                  key={index}
                  style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}
                >
                  {index > 0 && <span style={{ color: ink2, opacity: 0.4 }}>/</span>}
                  {labelEl}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>{right}</div>
    </header>
  );
}
