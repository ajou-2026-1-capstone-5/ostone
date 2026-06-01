import { Pill, Mono } from "@/shared/ui/ostone/atoms";

export function PackHeader() {
  return (
    <div
      style={{
        padding: "18px 28px 14px",
        borderBottom: "1px solid var(--line-2)",
      }}
    >
      {/* Row 1 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "10px",
        }}
      >
        <Pill tone="signal">검토 중 · v0.4</Pill>
        <Mono style={{ color: "var(--ink-3)", fontSize: "11px" }}>
          pack_id 4831 · 2026-04-28 · 강희원 작성
        </Mono>
        <div style={{ flex: 1 }} />
        <Mono style={{ color: "var(--ink-3)", fontSize: "11px" }}>
          last evaluated 41m ago · K@1 0.86
        </Mono>
      </div>

      {/* Row 2 */}
      <h1
        style={{
          fontSize: "22px",
          fontWeight: 450,
          letterSpacing: "-0.02em",
          fontFamily: "var(--sans)",
          margin: "0 0 8px",
          color: "var(--ink)",
          lineHeight: 1.3,
        }}
      >
        Card payment refund flow
        <span
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            color: "var(--signal-ink)",
          }}
        >
          {" "}
          — 환불 응대 기준 v2 적용
        </span>
      </h1>

      {/* Row 3 */}
      <div style={{ display: "inline-flex", gap: "20px" }}>
        {[
          { label: "문의 유형", count: 28 },
          { label: "필요 정보", count: 14 },
          { label: "응대 기준", count: 9 },
          { label: "주의 사항", count: 6 },
          { label: "워크플로우", count: 3 },
        ].map((meta) => (
          <div key={meta.label} style={{ display: "inline-flex", gap: "4px" }}>
            <Mono style={{ color: "var(--ink-3)", fontSize: "11px" }}>{meta.label}</Mono>
            <Mono
              style={{
                color: "var(--ink)",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              {meta.count}
            </Mono>
          </div>
        ))}
      </div>
    </div>
  );
}
