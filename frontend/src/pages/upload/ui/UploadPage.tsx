import React, { useEffect } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import type { ShellContext } from "@/shared/ui/ostone/chrome";
import { Eyebrow, Mono, Dot, Pill } from "@/shared/ui/ostone/atoms";
import { Dropzone } from "./sections/Dropzone";
import { DatasetsTable } from "./sections/DatasetsTable";
import { QualityIssues } from "./sections/QualityIssues";
import { ActiveRunTimeline } from "./sections/ActiveRunTimeline";
import { EvalChart } from "./sections/EvalChart";
import { StagePips } from "./sections/StagePips";

export const UploadPage: React.FC = () => {
  const { setCrumbs } = useOutletContext<ShellContext>();
  const { workspaceId: workspaceIdParam } = useParams<{ workspaceId: string }>();
  const workspaceId = workspaceIdParam ? Number(workspaceIdParam) : undefined;

  useEffect(() => {
    setCrumbs(["상담 로그 수집"]);
    return () => setCrumbs([]);
  }, [setCrumbs]);

  return (
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
          업로드한 데이터셋 1개당 도메인 팩 초안 1개를 생성하고, 여러 상담에서 추출한 intent, slot,
          policy, risk, workflow를 그 안에 모읍니다. 파이프라인은 6단계로 구성되며 각 단계의 진행
          상황을 실시간으로 모니터링할 수 있습니다.
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
        <Dropzone workspaceId={workspaceId} />

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
            <Mono style={{ fontSize: 11, color: "var(--ink)" }}>RUN-2026-04-28-T1422</Mono>
            <Pill tone="signal">running</Pill>
            <StagePips
              stages={[
                { id: "ingestion", status: "done" },
                { id: "preprocessing", status: "done" },
                { id: "intent-discovery", status: "done" },
                { id: "draft-generation", status: "done" },
                { id: "evaluation", status: "running" },
                { id: "publish-candidate", status: "pending" },
              ]}
            />
            <div style={{ flex: 1 }} />
            <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>started 4m 12s ago</Mono>
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

          <ActiveRunTimeline
            stages={[
              { name: "ingestion", status: "complete", duration: "3m 22s" },
              { name: "preprocessing", status: "complete", duration: "4m 12s" },
              { name: "intent-discovery", status: "complete", duration: "6m 34s" },
              { name: "draft-generation", status: "complete", duration: "4m 18s" },
              { name: "evaluation", status: "running", duration: "8m 01s" },
              { name: "publish-candidate", status: "pending", duration: "" },
            ]}
          />

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
            <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>ETA 12m 44s</Mono>
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
          <EvalChart
            runs={[
              { id: "run-1", label: "run-1", k1: 0.72, mappingRate: 0.65, separability: 0.78 },
              { id: "run-2", label: "run-2", k1: 0.78, mappingRate: 0.71, separability: 0.82 },
              { id: "run-3", label: "run-3", k1: 0.83, mappingRate: 0.74, separability: 0.85 },
              { id: "run-4", label: "run-4", k1: 0.86, mappingRate: 0.79, separability: 0.89 },
              { id: "run-5", label: "run-5", k1: 0.88, mappingRate: 0.82, separability: 0.92 },
            ]}
          />
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
                <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>{stat.label}:</Mono>
                <Mono style={{ fontSize: 10, color: "var(--ink)" }}>{stat.value}</Mono>
              </div>
            ))}
          </div>
        </div>

        <QualityIssues />
      </div>
    </div>
  );
};
