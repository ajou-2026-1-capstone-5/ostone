import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { useIntentDetail } from "../model/useIntentDetail";
import type { IntentDetail } from "../../../entities/intent";
import styles from "./IntentDetailPanel.module.css";

interface IntentDetailPanelProps {
  wsId: number;
  packId: number;
  versionId: number;
  intentId: number | null;
}

export function IntentDetailPanel({ wsId, packId, versionId, intentId }: IntentDetailPanelProps) {
  const state = useIntentDetail(wsId, packId, versionId, intentId);
  const errorCode = state.status === "error" ? state.code : undefined;
  const errorHttpStatus = state.status === "error" ? state.httpStatus : undefined;
  const errorMessage = state.status === "error" ? state.message : undefined;

  useEffect(() => {
    if (state.status !== "error") return;
    const message =
      errorHttpStatus === 404
        ? "intent를 찾을 수 없습니다."
        : errorMessage || "상세 정보를 불러오지 못했습니다.";

    toast.error(message, {
      id: `intent-detail-error-${wsId}-${packId}-${versionId}-${intentId ?? "none"}-${errorCode ?? errorHttpStatus ?? "unknown"}`,
    });
  }, [state.status, wsId, packId, versionId, intentId, errorCode, errorHttpStatus, errorMessage]);

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
      <DetailHeader detail={state.data} />
      <div className={styles.body}>
        <div className={styles.grid}>
          <InfoCard
            label="Status"
            value={<span className={styles.badge}>{state.data.status}</span>}
          />
          <InfoCard
            label="Taxonomy Level"
            value={<span className={styles.value}>LV {state.data.taxonomyLevel}</span>}
          />
          <InfoCard
            label="Parent Intent Id"
            value={<span className={styles.value}>{state.data.parentIntentId ?? "—"}</span>}
          />
          <InfoCard
            label="Created At"
            value={<span className={styles.value}>{formatDate(state.data.createdAt)}</span>}
          />
        </div>
        <JsonCard label="Source Cluster Ref" value={state.data.sourceClusterRef} />
        <JsonCard label="Entry Condition" value={state.data.entryConditionJson} />
        <JsonCard label="Evidence" value={state.data.evidenceJson} />
        <JsonCard label="Meta" value={state.data.metaJson} />
      </div>
    </section>
  );
}

function DetailHeader({ detail }: { detail: IntentDetail }) {
  return (
    <header className={styles.header}>
      <span className={styles.code}>{detail.intentCode}</span>
      <span className={styles.name}>{detail.name}</span>
      {detail.description && <span className={styles.description}>{detail.description}</span>}
      <span className={styles.updatedAt}>UPDATED · {formatDate(detail.updatedAt)}</span>
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
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>{label}</header>
      <div className={styles.cardBody}>
        <pre className={styles.jsonBlock}>
          <code>{formatJsonForDisplay(value)}</code>
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

function formatDate(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}
