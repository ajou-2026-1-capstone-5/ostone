import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useSlotDetail } from "../model/useSlotDetail";
import type { SlotDefinition } from "@/entities/slot";
import { ReadableJsonCard } from "@/shared/ui/ReadableJsonCard";
import styles from "./SlotDetailPanel.module.css";

interface SlotDetailPanelProps {
  wsId: number;
  packId: number;
  versionId: number;
  slotId: number | null;
}

export function SlotDetailPanel({ wsId, packId, versionId, slotId }: SlotDetailPanelProps) {
  const [retryKey, setRetryKey] = useState(0);
  const state = useSlotDetail(wsId, packId, versionId, slotId, retryKey);
  const errorCode = state.status === "error" ? state.code : undefined;
  const errorHttpStatus = state.status === "error" ? state.httpStatus : undefined;
  const errorMessage = state.status === "error" ? state.message : undefined;

  useEffect(() => {
    if (state.status !== "error") return;
    const message =
      errorHttpStatus === 404
        ? "확인 항목을 찾을 수 없습니다."
        : errorMessage || "상세 정보를 불러오지 못했습니다.";

    toast.error(message, {
      id: `slot-detail-error-${wsId}-${packId}-${versionId}-${slotId ?? "none"}-${errorCode}`,
    });
  }, [state.status, wsId, packId, versionId, slotId, errorCode, errorHttpStatus, errorMessage]);

  if (state.status === "idle") {
    return (
      <section className={styles.panel} aria-label="확인 항목 상세">
        <div className={styles.placeholder}>
          <span>확인 항목을 선택하세요.</span>
        </div>
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section className={styles.panel} aria-label="확인 항목 상세">
        <div className={styles.body}>
          <div className={styles.skeleton} />
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.panel} aria-label="확인 항목 상세">
        <div className={styles.placeholder}>
          <span>상세 정보를 불러오지 못했습니다.</span>
          <span className={styles.errorCode}>{errorCode}</span>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => setRetryKey((k) => k + 1)}
          >
            다시 시도
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-label="확인 항목 상세">
      <DetailHeader detail={state.data} />
      <div className={styles.body}>
        <div className={styles.grid}>
          <InfoCard
            label="항목 코드"
            value={<span className={styles.value}>{state.data.slotCode}</span>}
          />
          <InfoCard
            label="값 형식"
            value={<span className={styles.value}>{state.data.dataType}</span>}
          />
          <InfoCard
            label="상태"
            value={<span className={styles.badge}>{formatStatus(state.data.status)}</span>}
          />
          <InfoCard
            label="민감 정보"
            value={<span className={styles.value}>{state.data.isSensitive ? "예" : "아니오"}</span>}
          />
          <InfoCard
            label="생성일"
            value={<span className={styles.value}>{formatDate(state.data.createdAt ?? "")}</span>}
          />
          <InfoCard
            label="수정일"
            value={<span className={styles.value}>{formatDate(state.data.updatedAt ?? "")}</span>}
          />
        </div>
        <ReadableJsonCard label="검증 규칙" raw={state.data.validationRuleJson} />
        <ReadableJsonCard label="기본값" raw={state.data.defaultValueJson} />
        <ReadableJsonCard label="추가 정보" raw={state.data.metaJson} />
      </div>
    </section>
  );
}

function DetailHeader({ detail }: { detail: SlotDefinition }) {
  return (
    <header className={styles.header}>
      <span className={styles.code}>{detail.slotCode}</span>
      <span className={styles.name}>{detail.name}</span>
      {detail.description && <span className={styles.description}>{detail.description}</span>}
      <span className={styles.updatedAt}>수정일 · {formatDate(detail.updatedAt ?? "")}</span>
    </header>
  );
}

function formatStatus(status: SlotDefinition["status"]): string {
  return status === "ACTIVE" ? "사용중" : "사용 안 함";
}

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.card}>
      <header className={styles.cardHeader}>{label}</header>
      <div className={styles.cardBody}>{value}</div>
    </div>
  );
}

function formatDate(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
