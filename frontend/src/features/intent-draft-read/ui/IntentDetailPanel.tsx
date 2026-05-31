import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BracesIcon,
  FileTextIcon,
  GitBranchIcon,
  HashIcon,
  LayersIcon,
  MessageSquareIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useIntentDetail } from "../model/useIntentDetail";
import type { IntentDetail, IntentListState } from "../../../entities/intent";
import styles from "./IntentDetailPanel.module.css";

interface IntentDetailPanelProps {
  wsId: number;
  packId: number;
  versionId: number;
  intentId: number | null;
  intentListState: IntentListState;
  refreshKey?: number;
  headerActions?: (detail: IntentDetail) => ReactNode;
  afterHeader?: (detail: IntentDetail) => ReactNode;
  beforeJsonCards?: (detail: IntentDetail) => ReactNode;
  children?: (detail: IntentDetail) => ReactNode;
}

export function IntentDetailPanel({
  wsId,
  packId,
  versionId,
  intentId,
  intentListState,
  refreshKey,
  headerActions,
  afterHeader,
  beforeJsonCards,
  children,
}: IntentDetailPanelProps) {
  const state = useIntentDetail(wsId, packId, versionId, intentId, refreshKey);
  const errorCode = state.status === "error" ? state.code : undefined;
  const errorHttpStatus = state.status === "error" ? state.httpStatus : undefined;
  const errorMessage = state.status === "error" ? state.message : undefined;
  const parentIntentLabel =
    state.status === "ready"
      ? resolveParentIntentLabel(state.data.parentIntentId ?? null, intentListState)
      : "—";

  useEffect(() => {
    if (state.status !== "error") return;
    const message =
      errorHttpStatus === 404
        ? "상담 유형을 찾을 수 없습니다."
        : errorMessage || "상세 정보를 불러오지 못했습니다.";

    toast.error(message, {
      id: `intent-detail-error-${wsId}-${packId}-${versionId}-${intentId ?? "none"}-${errorCode ?? errorHttpStatus ?? "unknown"}`,
    });
  }, [state.status, wsId, packId, versionId, intentId, errorCode, errorHttpStatus, errorMessage]);

  if (state.status === "idle") {
    return (
      <section className={styles.panel} aria-label="상담 유형 상세">
        <div className={styles.placeholder}>
          <span>좌측 목록에서 상담 유형을 선택해 주세요.</span>
        </div>
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section className={styles.panel} aria-label="상담 유형 상세">
        <div className={styles.body}>
          <div className={styles.skeleton} />
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.panel} aria-label="상담 유형 상세">
        <div className={styles.placeholder}>
          <span>상세 정보를 불러오지 못했습니다.</span>
          <span className={styles.errorCode}>{errorCode}</span>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-label="상담 유형 상세">
      <DetailHeader detail={state.data} actions={headerActions?.(state.data)} />
      {afterHeader?.(state.data)}
      <div className={styles.body}>
        <div className={styles.grid}>
          <InfoCard
            label="상태"
            value={<span className={styles.badge}>{state.data.status}</span>}
          />
          <InfoCard
            label="분류 단계"
            value={<span className={styles.value}>LV {state.data.taxonomyLevel}</span>}
          />
          <InfoCard
            label="상위 상담 유형"
            value={<span className={styles.value}>{parentIntentLabel}</span>}
          />
          <InfoCard
            label="생성일"
            value={<span className={styles.value}>{formatDate(state.data.createdAt ?? "")}</span>}
          />
        </div>
        {beforeJsonCards?.(state.data)}
        <section className={styles.resourceSection} aria-labelledby="intent-resource-section-title">
          <IntentResourceSection detail={state.data} />
        </section>
      </div>
      {children?.(state.data)}
    </section>
  );
}

function resolveParentIntentLabel(
  parentIntentId: number | null,
  listState: IntentListState,
): string {
  if (parentIntentId === null) return "—";
  if (listState.status === "loading") return "불러오는 중...";
  if (listState.status === "error") return "확인 불가";

  const parent = listState.data.find((intent) => intent.id === parentIntentId);
  return parent?.name || parent?.intentCode || "확인 불가";
}

function DetailHeader({ detail, actions }: { detail: IntentDetail; actions?: ReactNode }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerTop}>
        <span className={styles.code}>{detail.intentCode}</span>
        {actions}
      </div>
      <div className={styles.headerText}>
        <span className={styles.name}>{detail.name ?? ""}</span>
        {detail.description && <span className={styles.description}>{detail.description}</span>}
        <span className={styles.updatedAt}>수정일 · {formatDate(detail.updatedAt ?? "")}</span>
      </div>
    </header>
  );
}

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>{label}</header>
      <div className={styles.cardBody}>{value}</div>
    </section>
  );
}

function IntentResourceSection({ detail }: { detail: IntentDetail }) {
  const [mode, setMode] = useState<"summary" | "json">("summary");

  return (
    <>
      <div className={styles.resourceSectionHeader}>
        <h2 id="intent-resource-section-title" className={styles.resourceSectionTitle}>
          내부 리소스
        </h2>
        <div className={styles.resourceToggleGroup} role="group" aria-label="내부 리소스 보기">
          <button
            type="button"
            aria-pressed={mode === "summary"}
            className={`${styles.resourceToggleButton} ${mode === "summary" ? styles.resourceToggleButtonActive : ""}`}
            onClick={() => setMode("summary")}
          >
            요약
          </button>
          <button
            type="button"
            aria-pressed={mode === "json"}
            className={`${styles.resourceToggleButton} ${mode === "json" ? styles.resourceToggleButtonActive : ""}`}
            onClick={() => setMode("json")}
          >
            JSON
          </button>
        </div>
      </div>

      {mode === "summary" ? (
        <div className={styles.resourceSummary}>
          <ClusterScope sourceClusterRef={detail.sourceClusterRef ?? ""} />
          <EvidenceReference evidenceJson={detail.evidenceJson ?? ""} />
        </div>
      ) : (
        <div className={styles.resourceGrid}>
          <JsonCard label="Source Cluster Ref" value={detail.sourceClusterRef ?? ""} />
          <JsonCard label="Entry Condition" value={detail.entryConditionJson ?? ""} />
          <JsonCard label="Evidence" value={detail.evidenceJson ?? ""} />
          <JsonCard label="Meta" value={detail.metaJson ?? ""} />
        </div>
      )}
    </>
  );
}

function ClusterScope({ sourceClusterRef }: { sourceClusterRef: string }) {
  const scope = useMemo(() => buildClusterScope(sourceClusterRef), [sourceClusterRef]);
  const hasContent = scope.items.length > 0 || scope.keywords.length > 0;

  return (
    <section className={styles.summaryBlock} aria-labelledby="intent-cluster-scope-title">
      <div className={styles.summaryBlockHeader}>
        <span className={styles.summaryBlockIcon} aria-hidden="true">
          <LayersIcon size={16} />
        </span>
        <h3 id="intent-cluster-scope-title" className={styles.summaryBlockTitle}>
          관련 키워드
        </h3>
      </div>
      {hasContent ? (
        <div className={styles.scopePanel}>
          {scope.items.length > 0 && (
            <ul className={styles.scopeList}>
              {scope.items.map((item, index) => (
                <li key={`${item.label}-${item.value}-${index}`} className={styles.scopeItem}>
                  <span className={styles.scopeIcon} aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className={styles.scopeItemText}>
                    <span className={styles.scopeLabel}>{item.label}</span>
                    <span className={styles.scopeValue}>{item.value}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {scope.keywords.length > 0 && (
            <div className={styles.keywordGroup} aria-label="keywords">
              {scope.keywords.map((keyword, index) => (
                <span key={`${keyword}-${index}`} className={styles.keywordChip}>
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <span className={styles.summaryEmpty}>관련 키워드 정보가 없습니다.</span>
      )}
    </section>
  );
}

function EvidenceReference({ evidenceJson }: { evidenceJson: string }) {
  const lines = useMemo(() => buildEvidenceLines(evidenceJson), [evidenceJson]);

  return (
    <section className={styles.summaryBlock} aria-labelledby="intent-evidence-title">
      <div className={styles.summaryBlockHeader}>
        <span className={styles.summaryBlockIcon} aria-hidden="true">
          <MessageSquareIcon size={16} />
        </span>
        <h3 id="intent-evidence-title" className={styles.summaryBlockTitle}>
          대표 문장
        </h3>
      </div>
      {lines.length > 0 ? (
        <ul className={styles.evidenceList}>
          {lines.map((line, index) => (
            <li key={`${line.turn}-${line.text}-${index}`} className={styles.evidenceItem}>
              <span className={styles.evidenceTurn}>{line.turn}</span>
              <span className={styles.evidenceText}>{line.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span className={styles.summaryEmpty}>대표 문장이 없습니다.</span>
      )}
    </section>
  );
}

function JsonCard({ label, value }: { label: string; value: string }) {
  const formatted = formatJsonForDisplay(value);
  const meta = describeJson(value);

  return (
    <section className={styles.resourceCard}>
      <header className={styles.resourceHeader}>
        <span className={styles.resourceLabel}>{label}</span>
        <span className={styles.resourceMeta}>{meta}</span>
      </header>
      <div className={styles.resourceBody}>
        <pre className={styles.jsonBlock}>
          <code>{formatted}</code>
        </pre>
      </div>
    </section>
  );
}

type JsonRecord = Record<string, unknown>;

interface ClusterScopeItem {
  label: string;
  value: string;
  icon: ReactNode;
}

interface ClusterScopeView {
  items: ClusterScopeItem[];
  keywords: string[];
}

interface EvidenceLine {
  turn: string;
  text: string;
}

const CUSTOMER_TURN_LABELS = new Set(["customer", "client", "user", "고객", "사용자"]);
const AGENT_TURN_LABELS = new Set([
  "agent",
  "assistant",
  "counselor",
  "consultant",
  "상담사",
]);

function buildClusterScope(raw: string): ClusterScopeView {
  const parsed = parseJson(raw);
  if (!isRecord(parsed)) return { items: [], keywords: [] };

  const items: ClusterScopeItem[] = [];
  const clusterId = readPrimitive(parsed.clusterId);
  const clusterSize = readPrimitive(parsed.clusterSize);
  const canonicalIntent = readString(parsed.canonicalIntent);
  const keywords = readStringArray(parsed.keywords).slice(0, 8);
  const segmentIds = Array.isArray(parsed.segmentIds) ? parsed.segmentIds : [];
  const source = readString(parsed.source);

  if (clusterId) {
    items.push({
      label: "묶음",
      value: `#${clusterId}`,
      icon: <HashIcon size={16} />,
    });
  }
  if (clusterSize) {
    items.push({
      label: "상담 건수",
      value: `${clusterSize}건`,
      icon: <FileTextIcon size={16} />,
    });
  }
  if (canonicalIntent) {
    items.push({
      label: "상담 유형",
      value: canonicalIntent,
      icon: <LayersIcon size={16} />,
    });
  }
  if (segmentIds.length > 0) {
    items.push({
      label: "상담 조각",
      value: `${segmentIds.length}개`,
      icon: <GitBranchIcon size={16} />,
    });
  }
  if (source) {
    items.push({
      label: "Source",
      value: source,
      icon: <BracesIcon size={16} />,
    });
  }

  return { items, keywords };
}

function buildEvidenceLines(raw: string): EvidenceLine[] {
  const parsed = parseJson(raw);
  const sourceItems = resolveEvidenceSourceItems(parsed);

  return sourceItems
    .map((item, index) => evidenceItemToLine(item, index))
    .filter((line): line is EvidenceLine => line !== null)
    .slice(0, 5);
}

function resolveEvidenceSourceItems(parsed: unknown): unknown[] {
  if (isRecord(parsed)) {
    const segmentTexts = Array.isArray(parsed.sampleSegmentTexts) ? parsed.sampleSegmentTexts : [];
    if (segmentTexts.length > 0) return segmentTexts;

    const intentPhrases = Array.isArray(parsed.sampleIntentPhrases) ? parsed.sampleIntentPhrases : [];
    if (intentPhrases.length > 0) return intentPhrases;
  }

  return Array.isArray(parsed) ? parsed : [];
}

function evidenceItemToLine(item: unknown, index: number): EvidenceLine | null {
  if (typeof item === "string") {
    const text = item.trim();
    if (!text) return null;
    const prefixed = splitTurnPrefix(text);
    if (prefixed) return prefixed;
    return { turn: `참고 ${index + 1}`, text };
  }

  if (!isRecord(item)) return null;
  const text =
    readString(item.text) ??
    readString(item.message) ??
    readString(item.canonicalText) ??
    readString(item.customerProblemText);
  if (!text) return null;

  const turn = readString(item.turn) ?? readString(item.role) ?? readString(item.speaker);
  return { turn: normalizeTurnLabel(turn) ?? `참고 ${index + 1}`, text };
}

function splitTurnPrefix(value: string): EvidenceLine | null {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex <= 0) return null;

  const prefix = value.slice(0, separatorIndex).trim();
  const text = value.slice(separatorIndex + 1).trim();
  if (!text || !isSupportedTurnPrefix(prefix)) return null;

  return { turn: normalizeTurnLabel(prefix) ?? prefix, text };
}

function isSupportedTurnPrefix(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return CUSTOMER_TURN_LABELS.has(normalized) || AGENT_TURN_LABELS.has(normalized);
}

function normalizeTurnLabel(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (CUSTOMER_TURN_LABELS.has(normalized)) return "상담자";
  if (AGENT_TURN_LABELS.has(normalized)) return "상담사";
  return value.trim();
}

function parseJson(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readPrimitive(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString("ko-KR");
  return null;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => readString(item))
    .filter((item): item is string => item !== null);
}

function formatJsonForDisplay(raw: string): string {
  if (!raw) return "—";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function describeJson(raw: string): string {
  if (!raw) return "EMPTY";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return `${parsed.length} ITEMS`;
    if (parsed !== null && typeof parsed === "object") {
      return `${Object.keys(parsed).length} KEYS`;
    }
    return typeof parsed === "string" ? "STRING" : "VALUE";
  } catch {
    return "RAW";
  }
}

function formatDate(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}
