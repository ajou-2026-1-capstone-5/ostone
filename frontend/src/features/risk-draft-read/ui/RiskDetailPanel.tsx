import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { RISK_READ_ERROR_MESSAGES } from "../model/mapApiError";
import { useRiskDetail } from "../model/useRiskDetail";
import type { RiskDefinition } from "@/entities/risk";
import styles from "./RiskDetailPanel.module.css";

type RiskJsonField = Readonly<{
  label: string;
  value: string;
}>;

interface RiskDetailPanelProps {
  workspaceId: number;
  packId: number;
  versionId: number;
  riskId: number | null;
}

export function RiskDetailPanel({
  workspaceId,
  packId,
  versionId,
  riskId,
}: Readonly<RiskDetailPanelProps>) {
  const [retryKey, setRetryKey] = useState(0);
  const state = useRiskDetail(workspaceId, packId, versionId, riskId, retryKey);
  const errorCode = state.status === "error" ? state.code : undefined;
  const errorHttpStatus = state.status === "error" ? state.httpStatus : undefined;
  const errorMessage = state.status === "error" ? state.message : undefined;

  useEffect(() => {
    if (state.status !== "error") return;
    const message =
      errorHttpStatus === 404
        ? RISK_READ_ERROR_MESSAGES.NOT_FOUND
        : errorMessage || RISK_READ_ERROR_MESSAGES.LOAD_DETAIL_FAILED;

    toast.error(message, {
      id: `risk-detail-error-${workspaceId}-${packId}-${versionId}-${riskId ?? "none"}-${errorCode ?? errorHttpStatus ?? "unknown"}`,
    });
  }, [
    state.status,
    workspaceId,
    packId,
    versionId,
    riskId,
    errorCode,
    errorHttpStatus,
    errorMessage,
  ]);

  if (state.status === "idle") {
    return (
      <section className={styles.panel} aria-label="위험요소 상세">
        <div className={styles.placeholder}>
          <span>위험요소를 선택하세요.</span>
        </div>
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section className={styles.panel} aria-label="위험요소 상세">
        <div className={styles.body}>
          <div className={styles.skeleton} />
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.panel} aria-label="위험요소 상세">
        <div className={styles.placeholder}>
          <span>상세 정보를 불러오지 못했습니다.</span>
          <span>
            {errorHttpStatus === 404 ? RISK_READ_ERROR_MESSAGES.NOT_FOUND : errorMessage}
          </span>
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

  const jsonFields: RiskJsonField[] = [
    { label: "Trigger Condition", value: state.data.triggerConditionJson },
    { label: "Handling Action", value: state.data.handlingActionJson },
    { label: "Evidence", value: state.data.evidenceJson },
    { label: "Meta", value: state.data.metaJson },
  ];

  return (
    <section className={styles.panel} aria-label="위험요소 상세">
      <DetailHeader detail={state.data} />
      <div className={styles.body}>
        <div className={styles.grid}>
          <InfoCard
            label="Risk Code"
            value={<span className={styles.value}>{state.data.riskCode}</span>}
          />
          <InfoCard
            label="Risk Level"
            value={<span className={styles.value}>{state.data.riskLevel}</span>}
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

function DetailHeader({ detail }: Readonly<{ detail: RiskDefinition }>) {
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        <span className={styles.code}>{detail.riskCode}</span>
        <span className={styles.name}>{detail.name}</span>
        {detail.description && <span className={styles.description}>{detail.description}</span>}
        <span className={styles.updatedAt}>UPDATED · {formatDate(detail.updatedAt)}</span>
      </div>
    </header>
  );
}

function InfoCard({ label, value }: Readonly<{ label: string; value: ReactNode }>) {
  return (
    <section className={styles.card} aria-labelledby={`risk-info-${label}`}>
      <header id={`risk-info-${label}`} className={styles.cardHeader}>
        {label}
      </header>
      <div className={styles.cardBody}>{value}</div>
    </section>
  );
}

function JsonCard({ label, value }: Readonly<RiskJsonField>) {
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
