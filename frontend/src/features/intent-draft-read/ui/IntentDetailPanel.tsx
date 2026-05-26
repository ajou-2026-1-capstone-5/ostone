import { useEffect, type ReactNode } from "react";
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
  const errorHttpStatus =
    state.status === "error" ? state.httpStatus : undefined;
  const errorMessage = state.status === "error" ? state.message : undefined;
  const parentIntentLabel =
    state.status === "ready"
      ? resolveParentIntentLabel(
          state.data.parentIntentId ?? null,
          intentListState,
        )
      : "—";

  useEffect(() => {
    if (state.status !== "error") return;
    const message =
      errorHttpStatus === 404
        ? "intent를 찾을 수 없습니다."
        : errorMessage || "상세 정보를 불러오지 못했습니다.";

    toast.error(message, {
      id: `intent-detail-error-${wsId}-${packId}-${versionId}-${intentId ?? "none"}-${errorCode ?? errorHttpStatus ?? "unknown"}`,
    });
  }, [
    state.status,
    wsId,
    packId,
    versionId,
    intentId,
    errorCode,
    errorHttpStatus,
    errorMessage,
  ]);

  if (state.status === "idle") {
    return (
      <section className={styles.panel} aria-label="intent 상세">
        <div className={styles.placeholder}>
          <span>좌측 목록에서 intent를 선택해 주세요.</span>
        </div>
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section className={styles.panel} aria-label="intent 상세">
        <div className={styles.body}>
          <div className={styles.skeleton} />
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.panel} aria-label="intent 상세">
        <div className={styles.placeholder}>
          <span>상세 정보를 불러오지 못했습니다.</span>
          <span className={styles.errorCode}>{errorCode}</span>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-label="intent 상세">
      <DetailHeader detail={state.data} actions={headerActions?.(state.data)} />
      {afterHeader?.(state.data)}
      <div className={styles.body}>
        <div className={styles.grid}>
          <InfoCard
            label="Status"
            value={<span className={styles.badge}>{state.data.status}</span>}
          />
          <InfoCard
            label="Taxonomy Level"
            value={
              <span className={styles.value}>
                LV {state.data.taxonomyLevel}
              </span>
            }
          />
          <InfoCard
            label="Parent Intent"
            value={<span className={styles.value}>{parentIntentLabel}</span>}
          />
          <InfoCard
            label="Created At"
            value={
              <span className={styles.value}>
                {formatDate(state.data.createdAt ?? "")}
              </span>
            }
          />
        </div>
        {beforeJsonCards?.(state.data)}
        <section
          className={styles.resourceSection}
          aria-labelledby="intent-resource-section-title"
        >
          <div className={styles.resourceSectionHeader}>
            <h2
              id="intent-resource-section-title"
              className={styles.resourceSectionTitle}
            >
              내부 리소스
            </h2>
            <span className={styles.resourceSectionMeta}>JSON FIELDS</span>
          </div>
          <div className={styles.resourceGrid}>
            <JsonCard
              label="Source Cluster Ref"
              value={state.data.sourceClusterRef ?? ""}
            />
            <JsonCard
              label="Entry Condition"
              value={state.data.entryConditionJson ?? ""}
            />
            <JsonCard label="Evidence" value={state.data.evidenceJson ?? ""} />
            <JsonCard label="Meta" value={state.data.metaJson ?? ""} />
          </div>
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

function DetailHeader({
  detail,
  actions,
}: {
  detail: IntentDetail;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerTop}>
        <span className={styles.code}>{detail.intentCode}</span>
        {actions}
      </div>
      <div className={styles.headerText}>
        <span className={styles.name}>{detail.name ?? ""}</span>
        {detail.description && (
          <span className={styles.description}>{detail.description}</span>
        )}
        <span className={styles.updatedAt}>
          UPDATED · {formatDate(detail.updatedAt ?? "")}
        </span>
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
