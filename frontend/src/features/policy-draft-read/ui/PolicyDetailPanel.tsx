import { useEffect, useState, type ReactNode } from "react";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { usePolicyDetail } from "../model/usePolicyDetail";
import type { PolicyDefinition } from "@/entities/policy";
import { ReadableJsonCard } from "@/shared/ui/ReadableJsonCard";
import styles from "./PolicyDetailPanel.module.css";

type PolicyJsonField = Readonly<{
  label: string;
  value: string;
}>;

interface PolicyDetailPanelProps {
  workspaceId: number;
  packId: number;
  versionId: number;
  policyId: number | null;
  onEdit: (policyId: number) => void;
}

export function PolicyDetailPanel({
  workspaceId,
  packId,
  versionId,
  policyId,
  onEdit,
}: Readonly<PolicyDetailPanelProps>) {
  const [retryKey, setRetryKey] = useState(0);
  const state = usePolicyDetail(workspaceId, packId, versionId, policyId, retryKey);
  const errorCode = state.status === "error" ? state.code : undefined;
  const errorHttpStatus = state.status === "error" ? state.httpStatus : undefined;
  const errorMessage = state.status === "error" ? state.message : undefined;

  useEffect(() => {
    if (state.status !== "error") return;
    const message =
      errorHttpStatus === 404
        ? "응대 기준을 찾을 수 없습니다."
        : errorMessage || "응대 기준 상세 정보를 불러오지 못했습니다.";

    toast.error(message, {
      id: `policy-detail-error-${workspaceId}-${packId}-${versionId}-${policyId ?? "none"}-${errorCode ?? errorHttpStatus ?? "unknown"}`,
    });
  }, [
    state.status,
    workspaceId,
    packId,
    versionId,
    policyId,
    errorCode,
    errorHttpStatus,
    errorMessage,
  ]);

  if (state.status === "idle") {
    return (
      <section className={styles.panel} aria-label="응대 기준 상세">
        <div className={styles.placeholder}>
          <span>선택된 응대 기준이 없습니다.</span>
          <span>목록에서 기준을 선택하면 상세 정보가 표시됩니다.</span>
        </div>
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section className={styles.panel} aria-label="응대 기준 상세">
        <div className={styles.body}>
          <div className={styles.skeleton} />
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.panel} aria-label="응대 기준 상세">
        <div className={styles.placeholder}>
          <span>상세 정보를 불러오지 못했습니다.</span>
          <span>{errorHttpStatus === 404 ? "응대 기준을 찾을 수 없습니다." : errorMessage}</span>
          <span className={styles.errorCode}>{errorCode}</span>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => setRetryKey((key) => key + 1)}
          >
            다시 시도
          </button>
        </div>
      </section>
    );
  }

  const jsonFields: PolicyJsonField[] = [
    { label: "적용 조건", value: state.data.conditionJson ?? "" },
    { label: "응대 방법", value: state.data.actionJson ?? "" },
    { label: "근거 로그", value: state.data.evidenceJson ?? "" },
    { label: "추가 정보", value: state.data.metaJson ?? "" },
  ];

  return (
    <section className={styles.panel} aria-label="응대 기준 상세">
      <DetailHeader detail={state.data} onEdit={() => onEdit(state.data.id!)} />
      <div className={styles.body}>
        <div className={styles.grid}>
          <InfoCard
            label="기준 코드"
            value={<span className={styles.value}>{state.data.policyCode}</span>}
          />
          <InfoCard
            label="중요도"
            value={<span className={styles.value}>{formatSeverity(state.data.severity)}</span>}
          />
          <InfoCard
            label="상태"
            value={
              <span
                className={`${styles.badge} ${
                  state.data.status === "ACTIVE" ? styles.badgeActive : styles.badgeInactive
                }`}
              >
                {formatStatus(state.data.status)}
              </span>
            }
          />
          <InfoCard
            label="버전 ID"
            value={<span className={styles.value}>{state.data.domainPackVersionId}</span>}
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
        {jsonFields.map((field) => (
          <ReadableJsonCard key={field.label} label={field.label} raw={field.value} />
        ))}
      </div>
    </section>
  );
}

function DetailHeader({
  detail,
  onEdit,
}: Readonly<{
  detail: PolicyDefinition;
  onEdit: () => void;
}>) {
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        <span className={styles.code}>{detail.policyCode}</span>
        <span className={styles.name}>{detail.name ?? ""}</span>
        {detail.description && <span className={styles.description}>{detail.description}</span>}
        <span className={styles.updatedAt}>수정일 · {formatDate(detail.updatedAt ?? "")}</span>
      </div>
      <button
        type="button"
        className={styles.editButton}
        onClick={onEdit}
        aria-label={`${detail.policyCode} 응대 기준 수정`}
      >
        <PencilIcon aria-hidden="true" />
        <span>수정</span>
      </button>
    </header>
  );
}

function formatStatus(status: PolicyDefinition["status"]): string {
  return status === "ACTIVE" ? "사용중" : "사용 안 함";
}

function formatSeverity(severity: PolicyDefinition["severity"]): string {
  if (!severity) return "—";
  const labels: Record<string, string> = {
    LOW: "낮음",
    MEDIUM: "보통",
    HIGH: "높음",
    CRITICAL: "긴급",
  };
  return labels[severity] ?? severity;
}

function InfoCard({ label, value }: Readonly<{ label: string; value: ReactNode }>) {
  return (
    <section className={styles.card} aria-labelledby={`policy-info-${label}`}>
      <header id={`policy-info-${label}`} className={styles.cardHeader}>
        {label}
      </header>
      <div className={styles.cardBody}>{value}</div>
    </section>
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
