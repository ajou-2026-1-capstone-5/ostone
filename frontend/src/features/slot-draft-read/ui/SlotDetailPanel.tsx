import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { useSlotDetail } from "../model/useSlotDetail";
import type { SlotDefinition } from "@/entities/slot";
import styles from "./SlotDetailPanel.module.css";

interface SlotDetailPanelProps {
  wsId: number;
  packId: number;
  versionId: number;
  slotId: number | null;
}

export function SlotDetailPanel({ wsId, packId, versionId, slotId }: SlotDetailPanelProps) {
  const state = useSlotDetail(wsId, packId, versionId, slotId);
  const errorCode = state.status === "error" ? state.code : undefined;
  const errorHttpStatus = state.status === "error" ? state.httpStatus : undefined;
  const errorMessage = state.status === "error" ? state.message : undefined;

  useEffect(() => {
    if (state.status !== "error") return;
    const message =
      errorHttpStatus === 404
        ? "슬롯을 찾을 수 없습니다."
        : errorMessage || "상세 정보를 불러오지 못했습니다.";

    toast.error(message, {
      id: `slot-detail-error-${wsId}-${packId}-${versionId}-${slotId ?? "none"}-${errorCode ?? errorHttpStatus ?? "unknown"}`,
    });
  }, [state.status, wsId, packId, versionId, slotId, errorCode, errorHttpStatus, errorMessage]);

  if (state.status === "idle") {
    return (
      <section className={styles.panel} aria-label="슬롯 상세">
        <div className={styles.placeholder}>
          <span>슬롯을 선택하세요.</span>
        </div>
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section className={styles.panel} aria-label="슬롯 상세">
        <div className={styles.body}>
          <div className={styles.skeleton} />
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.panel} aria-label="슬롯 상세">
        <div className={styles.placeholder}>
          <span>상세 정보를 불러오지 못했습니다.</span>
          <span className={styles.errorCode}>{errorCode}</span>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-label="슬롯 상세">
      <DetailHeader detail={state.data} />
      <div className={styles.body}>
        <div className={styles.grid}>
          <InfoCard
            label="Slot Code"
            value={<span className={styles.value}>{state.data.slotCode}</span>}
          />
          <InfoCard
            label="Data Type"
            value={<span className={styles.value}>{state.data.dataType}</span>}
          />
          <InfoCard
            label="Status"
            value={<span className={styles.badge}>{state.data.status}</span>}
          />
          <InfoCard
            label="Is Sensitive"
            value={
              <span className={styles.value}>{state.data.isSensitive ? "YES" : "NO"}</span>
            }
          />
          <InfoCard
            label="Created At"
            value={<span className={styles.value}>{formatDate(state.data.createdAt)}</span>}
          />
          <InfoCard
            label="Updated At"
            value={<span className={styles.value}>{formatDate(state.data.updatedAt)}</span>}
          />
        </div>
        <JsonCard label="Validation Rule" value={state.data.validationRuleJson} />
        <JsonCard label="Default Value" value={state.data.defaultValueJson} />
        <JsonCard label="Meta" value={state.data.metaJson} />
      </div>
    </section>
  );
}

function DetailHeader({ detail }: { detail: SlotDefinition }) {
  return (
    <header className={styles.header}>
      <span className={styles.code}>{detail.slotCode}</span>
      <span className={styles.name}>{detail.name}</span>
      {detail.description && (
        <span className={styles.description}>{detail.description}</span>
      )}
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

function JsonCard({ label, value }: { label: string; value: string | null }) {
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>{label}</header>
      <div className={styles.cardBody}>
        <pre className={styles.jsonBlock}>
          <code>{value === null ? "—" : formatJsonForDisplay(value)}</code>
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
