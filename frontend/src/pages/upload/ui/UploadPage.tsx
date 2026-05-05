import React from "react";
import { LogUploadForm } from "../../../features/log-upload/ui/LogUploadForm";
import { OstoneShell } from "@/widgets/ostone-shell";
import { Eyebrow, Mono, Dot, Pill } from "@/shared/ui/ostone/atoms";
import { Dropzone } from "./sections/Dropzone";
import { DatasetsTable } from "./sections/DatasetsTable";
import { QualityIssues } from "./sections/QualityIssues";

void LogUploadForm;

export const UploadPage: React.FC = () => {
  return (
    <OstoneShell active="upload" crumbs={["CARD-CS", "Pipeline · Datasets"]}>
      <div style={{ padding: "24px 28px 40px" }}>
        <div
          style={{
            paddingBottom: "22px",
            borderBottom: "1px solid var(--line-2)",
          }}
        >
          <Eyebrow>Pipeline &middot; 6 stages &middot; last run 14:22</Eyebrow>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 350,
              letterSpacing: "-0.022em",
              lineHeight: 1.15,
              color: "var(--ink)",
              marginTop: 8,
            }}
          >
            상담 로그 &rarr;{" "}
            <span
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                color: "var(--signal-ink)",
              }}
            >
              도메인 팩 초안
            </span>
          </h1>
          <p
            style={{
              maxWidth: 620,
              fontSize: 13,
              color: "var(--ink-3)",
              lineHeight: 1.5,
              marginTop: 8,
            }}
          >
            대량의 상담 로그를 자동으로 분석하여 intent, slot, policy, risk,
            workflow를 포함한 도메인 팩 초안을 생성합니다. 파이프라인은
            6단계로 구성되며 각 단계의 진행 상황을 실시간으로 모니터링할 수
            있습니다.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 1fr",
            gap: 18,
            marginTop: 24,
          }}
        >
          <Dropzone />

          <div
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-2)",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Dot tone="signal" size={6} />
              <Mono style={{ fontSize: 11, color: "var(--ink)" }}>
                RUN-2026-04-28-T1422
              </Mono>
              <Pill tone="signal">running</Pill>
              <div style={{ flex: 1 }} />
              <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>
                started 4m 12s ago
              </Mono>
            </div>

            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ink)",
                }}
              >
                refund_logs_april_v3.jsonl
              </div>
              <Mono style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 4 }}>
                412 MB &middot; 41,238 conversations &middot; 187,224 turns
              </Mono>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px 0",
                background: "var(--paper-2)",
                borderRadius: "var(--r-2)",
              }}
            >
              <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>
                6-stage timeline (T12)
              </Mono>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <button
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--ink-2)",
                  background: "var(--paper-2)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-2)",
                  cursor: "pointer",
                }}
              >
                Pause
              </button>
              <button
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--danger)",
                  background: "var(--paper-2)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-2)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <div style={{ flex: 1 }} />
              <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>
                ETA 12m 44s
              </Mono>
            </div>
          </div>
        </div>

        <DatasetsTable />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 18,
            marginTop: 8,
          }}
        >
          <div
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-2)",
              padding: "20px",
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <Eyebrow>Evaluation timeline</Eyebrow>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 120,
                background: "var(--paper-2)",
                borderRadius: "var(--r-2)",
              }}
            >
              <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>
                EvalChart (T12)
              </Mono>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              {[
                { label: "K@1", value: "0.86" },
                { label: "Mapping rate", value: "0.79" },
                { label: "Separability", value: "0.92" },
                { label: "Outlier rate", value: "0.03" },
              ].map((stat) => (
                <div key={stat.label} style={{ display: "flex", gap: 4 }}>
                  <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>
                    {stat.label}:
                  </Mono>
                  <Mono style={{ fontSize: 10, color: "var(--ink)" }}>
                    {stat.value}
                  </Mono>
                </div>
              ))}
            </div>
          </div>

          <QualityIssues />
        </div>
      </div>
    </OstoneShell>
  );
};
