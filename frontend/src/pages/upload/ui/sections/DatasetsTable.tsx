import React from "react";
import { Eyebrow, Mono, Icon, Bar } from "@/shared/ui/ostone/atoms";

interface DatasetRow {
  name: string;
  size: string;
  conversations: string;
  turns: string;
  quality: number;
  uploadedAt: string;
  status?: "running" | "idle";
}

const DATASET_ROWS: DatasetRow[] = [
  {
    name: "refund_logs_april_v3.jsonl",
    size: "412 MB",
    conversations: "41,238",
    turns: "187,224",
    quality: 0.94,
    uploadedAt: "2026-04-28 14:22",
    status: "running",
  },
  {
    name: "support_march_v2.csv",
    size: "1.2 GB",
    conversations: "128,410",
    turns: "512,840",
    quality: 0.91,
    uploadedAt: "2026-03-15 09:10",
  },
  {
    name: "chat_logs_q1.parquet",
    size: "3.8 GB",
    conversations: "401,200",
    turns: "1,604,800",
    quality: 0.88,
    uploadedAt: "2026-03-01 11:45",
  },
  {
    name: "legacy_2025.jsonl",
    size: "890 MB",
    conversations: "92,100",
    turns: "368,400",
    quality: 0.85,
    uploadedAt: "2025-12-20 16:30",
  },
  {
    name: "test_sample_1k.csv",
    size: "12 MB",
    conversations: "1,000",
    turns: "4,000",
    quality: 0.97,
    uploadedAt: "2026-04-10 08:00",
  },
];

export const DatasetsTable: React.FC = () => {
  return (
    <div style={{ padding: "20px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          상담 로그
        </h2>
        <Eyebrow>&middot; CARD-CS 워크스페이스 7개</Eyebrow>
        <div style={{ flex: 1 }} />
        <Mono style={{ fontSize: 12, color: "var(--ink-3)" }}>14.2 GB</Mono>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 0.9fr 1fr 1.4fr 0.9fr 0.9fr 32px",
        }}
      >
        {["파일명", "크기", "상담 건수", "처리 단계", "품질", "업로드일", ""].map((h) => (
          <div
            key={h}
            style={{
              background: "var(--paper-2)",
              padding: "10px 14px",
              fontFamily: "var(--mono)",
              fontSize: 10,
              textTransform: "uppercase",
              color: "var(--ink-3)",
              letterSpacing: "0.04em",
            }}
          >
            {h}
          </div>
        ))}

        {DATASET_ROWS.map((row, _i) => (
          <React.Fragment key={row.name}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                background: row.status === "running" ? "var(--signal-bg)" : "transparent",
                borderTop: "1px solid var(--line-2)",
              }}
            >
              <Icon name="file" size={14} className="t-icon" />
              <Mono style={{ fontSize: 11, color: "var(--ink)" }}>{row.name}</Mono>
            </div>
            <div
              style={{
                padding: "10px 14px",
                background: row.status === "running" ? "var(--signal-bg)" : "transparent",
                borderTop: "1px solid var(--line-2)",
              }}
            >
              <Mono style={{ fontSize: 11, color: "var(--ink-2)" }}>{row.size}</Mono>
            </div>
            <div
              style={{
                padding: "10px 14px",
                background: row.status === "running" ? "var(--signal-bg)" : "transparent",
                borderTop: "1px solid var(--line-2)",
              }}
            >
              <Mono style={{ fontSize: 11, color: "var(--ink-2)" }}>{row.conversations}</Mono>
            </div>
            <div
              style={{
                padding: "10px 14px",
                background: row.status === "running" ? "var(--signal-bg)" : "transparent",
                borderTop: "1px solid var(--line-2)",
              }}
            >
              <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>처리 단계 12</Mono>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                background: row.status === "running" ? "var(--signal-bg)" : "transparent",
                borderTop: "1px solid var(--line-2)",
              }}
            >
              <Bar value={row.quality} tone="signal" w={60} h={3} />
              <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>
                {Math.round(row.quality * 100)}%
              </Mono>
            </div>
            <div
              style={{
                padding: "10px 14px",
                background: row.status === "running" ? "var(--signal-bg)" : "transparent",
                borderTop: "1px solid var(--line-2)",
              }}
            >
              <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>{row.uploadedAt}</Mono>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 0",
                background: row.status === "running" ? "var(--signal-bg)" : "transparent",
                borderTop: "1px solid var(--line-2)",
              }}
            >
              <button
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--ink-3)",
                }}
                aria-label="추가 작업"
              >
                <Icon name="dot3" size={14} />
              </button>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
