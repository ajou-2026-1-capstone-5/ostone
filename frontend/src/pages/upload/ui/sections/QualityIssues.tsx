import React from "react";
import { Eyebrow, Mono, Pill } from "@/shared/ui/ostone/atoms";

interface Issue {
  severity: "high" | "medium" | "low";
  id: string;
  convs: string;
  description: string;
}

const ISSUES: Issue[] = [
  {
    severity: "high",
    id: "intent_023",
    convs: "상담 12건",
    description: "상담 유형 intent_019와 범위가 겹칩니다",
  },
  {
    severity: "high",
    id: "slot_007",
    convs: "상담 8건",
    description: "필수 확인 항목 amount가 빠져 있습니다",
  },
  {
    severity: "medium",
    id: "policy_004",
    convs: "상담 3건",
    description: "응대 기준이 서로 순환 참조됩니다",
  },
  {
    severity: "medium",
    id: "risk_001",
    convs: "상담 2건",
    description: "주의 사항 감지 기준이 너무 엄격합니다",
  },
];

export const QualityIssues: React.FC = () => {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-2)",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <Eyebrow>품질 점검 필요 항목</Eyebrow>
        <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>4건</Mono>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {ISSUES.map((issue) => (
          <div
            key={issue.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              background: "var(--paper-2)",
              borderRadius: "var(--r-2)",
            }}
          >
            <Pill tone={issue.severity === "high" ? "danger" : "warn"}>
              {issue.severity === "high" ? "높음" : "보통"}
            </Pill>
            <Mono style={{ fontSize: 11, color: "var(--ink)" }}>{issue.id}</Mono>
            <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>{issue.convs}</Mono>
            <span
              style={{
                fontSize: 12,
                color: "var(--ink-2)",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {issue.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
