import type { ReactNode } from "react";

interface TopbarProps {
  crumbs: string[];
  right?: ReactNode;
  left?: ReactNode;
  dark?: boolean;
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
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <div
                  key={index}
                  style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}
                >
                  {index > 0 && <span style={{ color: ink2, opacity: 0.4 }}>/</span>}
                  <span
                    className="crumb"
                    style={{
                      color: isLast ? ink : ink2,
                      fontWeight: isLast ? 500 : 400,
                    }}
                  >
                    {crumb}
                  </span>
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
