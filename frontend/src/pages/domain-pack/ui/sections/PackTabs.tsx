import { useState } from "react";

const TABS = [
  { label: "문의 유형", count: 3 },
  { label: "필요 정보", count: 2 },
  { label: "응대 기준", count: 4 },
  { label: "주의 사항", count: 5 },
  { label: "워크플로우", count: 3 },
  { label: "테스트", count: 0 },
  { label: "버전 기록", count: null },
];

export function PackTabs() {
  const [activeIndex, setActiveIndex] = useState(4);

  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        gap: "4px",
        padding: "0 28px",
        borderBottom: "1px solid var(--line-2)",
        overflowX: "auto",
      }}
    >
      {TABS.map((tab, i) => {
        const isActive = i === activeIndex;
        const display = tab.count !== null ? `${tab.label} · ${tab.count}` : tab.label;
        return (
          <button
            key={tab.label}
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveIndex(i)}
            style={{
              padding: "10px 16px",
              fontFamily: "var(--mono)",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              cursor: "pointer",
              border: "none",
              borderBottom: isActive ? "1.5px solid var(--signal)" : "1.5px solid transparent",
              background: "transparent",
              color: isActive ? "var(--ink)" : "var(--ink-3)",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = "var(--ink)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = "var(--ink-3)";
              }
            }}
          >
            {display}
          </button>
        );
      })}
    </div>
  );
}
