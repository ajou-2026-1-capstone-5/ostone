import { useEffect, useState, type ReactNode } from "react";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { usePolicyDetail } from "../model/usePolicyDetail";
import type { PolicyDefinition } from "@/entities/policy";
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
        ? "정책을 찾을 수 없습니다."
        : errorMessage || "정책 상세 정보를 불러오지 못했습니다.";

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
      <section className={styles.panel} aria-label="정책 상세">
        <div className={styles.placeholder}>
          <span>정책을 선택하세요.</span>
        </div>
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section className={styles.panel} aria-label="정책 상세">
        <div className={styles.body}>
          <div className={styles.skeleton} />
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.panel} aria-label="정책 상세">
        <div className={styles.placeholder}>
          <span>상세 정보를 불러오지 못했습니다.</span>
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
    { label: "Condition", value: state.data.conditionJson },
    { label: "Action", value: state.data.actionJson },
    { label: "Evidence", value: state.data.evidenceJson },
    { label: "Meta", value: state.data.metaJson },
  ];

  return (
    <section className={styles.panel} aria-label="정책 상세">
      <DetailHeader detail={state.data} onEdit={() => onEdit(state.data.id)} />
      <div className={styles.body}>
        <div className={styles.grid}>
          <InfoCard
            label="Policy Code"
            value={<span className={styles.value}>{state.data.policyCode}</span>}
          />
          <InfoCard
            label="Severity"
            value={<span className={styles.value}>{state.data.severity ?? "—"}</span>}
          />
          <InfoCard
            label="Status"
            value={
              <span
                className={`${styles.badge} ${
                  state.data.status === "ACTIVE" ? styles.badgeActive : styles.badgeInactive
                }`}
              >
                {state.data.status === "ACTIVE" ? "● ACTIVE" : "○ INACTIVE"}
              </span>
            }
          />
          <InfoCard
            label="Version Id"
            value={<span className={styles.value}>{state.data.domainPackVersionId}</span>}
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
        {jsonFields.map((field) => (
          <JsonCard key={field.label} label={field.label} value={field.value} />
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
        <span className={styles.name}>{detail.name}</span>
        {detail.description && <span className={styles.description}>{detail.description}</span>}
        <span className={styles.updatedAt}>UPDATED · {formatDate(detail.updatedAt)}</span>
      </div>
      <button
        type="button"
        className={styles.editButton}
        onClick={onEdit}
        aria-label={`${detail.policyCode} 정책 수정`}
      >
        <PencilIcon aria-hidden="true" />
        <span>수정</span>
      </button>
    </header>
  );
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

function JsonCard({ label, value }: Readonly<PolicyJsonField>) {
  const formattedValue = formatJsonForDisplay(value);

  return (
    <section className={styles.card} data-json-field={label.toLowerCase()}>
      <header className={styles.cardHeader}>{label}</header>
      <div className={styles.cardBody}>
        <pre className={styles.jsonBlock}>
          <code>{formattedValue}</code>
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
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
