import { useState, useMemo } from "react";
import { parseSummaryJson } from "../model/parseSummaryJson";
import styles from "./SummaryJsonCard.module.css";

type SummaryData = Record<string, unknown>;

interface SummaryItem {
  label: string;
  value: string;
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function isRecord(value: unknown): value is SummaryData {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readPath(data: SummaryData, path: string[]): unknown {
  return path.reduce<unknown>((acc, key) => (isRecord(acc) ? acc[key] : undefined), data);
}

function firstValue(data: SummaryData, paths: string[][]): unknown {
  for (const path of paths) {
    const value = readPath(data, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function formatNumber(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString("ko-KR");
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed.toLocaleString("ko-KR");
  }
  return null;
}

function formatRate(value: unknown): string | null {
  const numeric =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric)) return null;
  const ratio = numeric <= 1 ? numeric * 100 : numeric;
  return `${Math.round(ratio)}%`;
}

function formatDraftSource(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const baseVersion = value.baseVersionNo ?? value.baseVersionId;
  return baseVersion ? `v${String(baseVersion)}` : null;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (isRecord(item) && typeof item.message === "string") return item.message;
      if (isRecord(item) && typeof item.title === "string") return item.title;
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function buildSummary(data: SummaryData) {
  const topic = typeof data.topic === "string" ? data.topic.trim() : "";
  const source = firstValue(data, [["generation", "source"], ["source"], ["sourceType"]]);
  const clusterCount = firstValue(data, [["generation", "clusterCount"], ["clusterCount"]]);
  const draftSource = firstValue(data, [["draftSource"]]);
  const needsReviewCount = firstValue(data, [["review", "needsReviewCount"], ["needsReviewCount"]]);

  const highlights: SummaryItem[] = [];
  if (source) highlights.push({ label: "생성 출처", value: renderValue(source) });
  const clusterLabel = formatNumber(clusterCount);
  if (clusterLabel) highlights.push({ label: "클러스터", value: clusterLabel });
  const draftSourceLabel = formatDraftSource(draftSource);
  if (draftSourceLabel) highlights.push({ label: "변경 기준", value: draftSourceLabel });
  const reviewCountLabel = formatNumber(needsReviewCount);
  if (reviewCountLabel) highlights.push({ label: "검토 필요", value: reviewCountLabel });

  const metrics: SummaryItem[] = [
    {
      label: "매핑률",
      value: formatRate(firstValue(data, [["quality", "mappingRate"], ["mappingRate"]])) ?? "",
    },
    {
      label: "이탈률",
      value: formatRate(firstValue(data, [["quality", "outlierRate"], ["outlierRate"]])) ?? "",
    },
    {
      label: "응대 흐름 분리도",
      value:
        formatRate(
          firstValue(data, [["quality", "workflowSeparability"], ["workflowSeparability"]]),
        ) ?? "",
    },
  ].filter((item) => item.value);

  const issues = [
    ...readStringList(firstValue(data, [["review", "topIssues"], ["topIssues"]])),
    ...readStringList(firstValue(data, [["review", "issues"], ["issues"]])),
  ];

  return { topic, highlights, metrics, issues };
}

interface SummaryJsonCardProps {
  summaryJson: string;
}

export function SummaryJsonCard({ summaryJson }: SummaryJsonCardProps) {
  const [mode, setMode] = useState<"card" | "raw">("card");

  const parsed = useMemo(() => parseSummaryJson(summaryJson), [summaryJson]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>도메인팩 정보</span>
        <div className={styles.toggleGroup} role="group" aria-label="보기 방식">
          <button
            type="button"
            className={`${styles.toggleBtn} ${mode === "card" ? styles.active : ""}`}
            onClick={() => setMode("card")}
            aria-pressed={mode === "card"}
          >
            요약
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${mode === "raw" ? styles.active : ""}`}
            onClick={() => setMode("raw")}
            aria-pressed={mode === "raw"}
          >
            전체 JSON
          </button>
        </div>
      </div>
      <div className={styles.cardBody}>
        {mode === "card" ? (
          <>
            {!parsed.ok && (
              <p className={styles.fallbackWarning} role="alert">
                JSON 파싱 실패 - 원문 표시
              </p>
            )}
            {parsed.ok ? (
              <ReadableSummary data={parsed.data} />
            ) : (
              <pre className={styles.rawPre}>
                <code>{parsed.raw}</code>
              </pre>
            )}
          </>
        ) : (
          <StructuredJsonView parsed={parsed} raw={summaryJson} />
        )}
      </div>
    </div>
  );
}

function ReadableSummary({ data }: { data: SummaryData }) {
  const summary = buildSummary(data);
  const hasContent =
    summary.topic ||
    summary.highlights.length > 0 ||
    summary.metrics.length > 0 ||
    summary.issues.length > 0;

  if (!hasContent) return <span className={styles.empty}>내용 없음</span>;

  return (
    <div className={styles.summaryLayout}>
      {summary.topic && (
        <div className={styles.topicBlock}>
          <span className={styles.key}>topic</span>
          <strong className={styles.topicValue}>{summary.topic}</strong>
        </div>
      )}

      {summary.highlights.length > 0 && (
        <div className={styles.highlightGrid}>
          {summary.highlights.map((item) => (
            <div key={item.label} className={styles.highlightItem}>
              <span className={styles.key}>{item.label}</span>
              <strong className={styles.highlightValue}>{item.value}</strong>
            </div>
          ))}
        </div>
      )}

      {summary.metrics.length > 0 && (
        <section className={styles.summarySection}>
          <h4 className={styles.summarySectionTitle}>품질 지표</h4>
          <div className={styles.metricGrid}>
            {summary.metrics.map((item) => (
              <div key={item.label} className={styles.metricItem}>
                <span className={styles.metricLabel}>{item.label}</span>
                <span className={styles.metricValue}>{item.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {summary.issues.length > 0 && (
        <section className={styles.summarySection}>
          <h4 className={styles.summarySectionTitle}>검토 포인트</h4>
          <ul className={styles.issueList}>
            {summary.issues.map((issue, index) => (
              <li key={`${issue}-${index}`}>{issue}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StructuredJsonView({
  parsed,
  raw,
}: {
  parsed: ReturnType<typeof parseSummaryJson>;
  raw: string;
}) {
  if (!parsed.ok) {
    return (
      <pre className={styles.rawPre}>
        <code>{raw}</code>
      </pre>
    );
  }

  const entries = Object.entries(parsed.data);
  if (entries.length === 0) return <span className={styles.empty}>내용 없음</span>;

  return (
    <div className={styles.jsonList}>
      {entries.map(([key, value]) => (
        <div key={key} className={styles.jsonRow}>
          <span className={styles.jsonKey}>{key}</span>
          <JsonValue value={value} />
        </div>
      ))}
    </div>
  );
}

function JsonValue({ value }: { value: unknown }) {
  if (isRecord(value) || Array.isArray(value)) {
    return <code className={styles.jsonCode}>{JSON.stringify(value, null, 2)}</code>;
  }

  return <span className={styles.jsonValue}>{renderValue(value)}</span>;
}
