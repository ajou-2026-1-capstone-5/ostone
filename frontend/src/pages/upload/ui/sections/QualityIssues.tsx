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
    convs: "12 convs",
    description: "Overlapping with intent_019",
  },
  {
    severity: "high",
    id: "slot_007",
    convs: "8 convs",
    description: "Missing required slot: amount",
  },
  {
    severity: "medium",
    id: "policy_004",
    convs: "3 convs",
    description: "Circular policy reference",
  },
  {
    severity: "medium",
    id: "risk_001",
    convs: "2 convs",
    description: "Risk threshold too strict",
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
        <Eyebrow>Quality issues</Eyebrow>
        <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>4 issues</Mono>
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
            <Pill tone={issue.severity === "high" ? "danger" : "warn"}>{issue.severity}</Pill>
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
