import { useEffect, useState, type ReactNode } from "react";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { RISK_READ_ERROR_MESSAGES } from "../model/mapApiError";
import { useRiskDetail } from "../model/useRiskDetail";
import type { RiskDefinition } from "@/entities/risk";
import styles from "./RiskDetailPanel.module.css";

const RISK_JSON_FIELDS = [
  ["Trigger Condition", "triggerConditionJson"],
  ["Handling Action", "handlingActionJson"],
  ["Evidence", "evidenceJson"],
  ["Meta", "metaJson"],
] as const;

const STATUS_LABELS = {
  ACTIVE: "● ACTIVE",
  INACTIVE: "○ INACTIVE",
} as const;

const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

type RiskJsonKey = (typeof RISK_JSON_FIELDS)[number][1];

type RiskInfoField = Readonly<{
  label: string;
  value: ReactNode;
}>;

interface RiskDetailPanelProps {
  workspaceId: number;
  packId: number;
  versionId: number;
  riskId: number | null;
  onEdit: (riskId: number) => void;
}

export function RiskDetailPanel({
  workspaceId,
  packId,
  versionId,
  riskId,
  onEdit,
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
          <span>{errorHttpStatus === 404 ? RISK_READ_ERROR_MESSAGES.NOT_FOUND : errorMessage}</span>
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

  const detail = state.data;
  const infoFields: RiskInfoField[] = [
    { label: "Risk Code", value: detail.riskCode },
    { label: "Risk Level", value: detail.riskLevel },
    { label: "Status", value: <StatusBadge status={detail.status} /> },
    { label: "Version Id", value: detail.domainPackVersionId },
    { label: "Created At", value: formatDate(detail.createdAt) },
    { label: "Updated At", value: formatDate(detail.updatedAt) },
  ];

  return (
    <section className={styles.panel} aria-label="위험요소 상세">
      <DetailHeader detail={detail} onEdit={() => onEdit(detail.id)} />
      <div className={styles.body}>
        <InfoGrid fields={infoFields} />
        {RISK_JSON_FIELDS.map(([label, key]) => (
          <JsonCard key={key} label={label} value={detail[key]} />
        ))}
      </div>
    </section>
  );
}

function DetailHeader({
  detail,
  onEdit,
}: Readonly<{ detail: RiskDefinition; onEdit: () => void }>) {
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        <span className={styles.code}>{detail.riskCode}</span>
        <span className={styles.name}>{detail.name}</span>
        {detail.description && <span className={styles.description}>{detail.description}</span>}
        <span className={styles.updatedAt}>UPDATED · {formatDate(detail.updatedAt)}</span>
      </div>
      <button
        type="button"
        className={styles.editButton}
        onClick={onEdit}
        aria-label={`${detail.riskCode} 위험요소 수정`}
      >
        <PencilIcon aria-hidden="true" />
        <span>수정</span>
      </button>
    </header>
  );
}

function InfoGrid({ fields }: Readonly<{ fields: readonly RiskInfoField[] }>) {
  return (
    <dl className={styles.grid}>
      {fields.map((field) => (
        <div key={field.label} className={styles.card}>
          <dt className={styles.cardHeader}>{field.label}</dt>
          <dd className={`${styles.cardBody} ${styles.value}`}>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function JsonCard({
  label,
  value,
}: Readonly<{ label: string; value: RiskDefinition[RiskJsonKey] }>) {
  return (
    <article className={styles.card} data-json-field={label.toLowerCase()}>
      <div className={styles.cardHeader}>{label}</div>
      <div className={styles.cardBody}>
        <pre className={styles.jsonBlock}>
          <code>{formatJsonForDisplay(value)}</code>
        </pre>
      </div>
    </article>
  );
}

function StatusBadge({ status }: Readonly<{ status: RiskDefinition["status"] }>) {
  const statusClassName = status === "ACTIVE" ? styles.badgeActive : styles.badgeInactive;

  return <span className={`${styles.badge} ${statusClassName}`}>{STATUS_LABELS[status]}</span>;
}

function formatJsonForDisplay(raw: string): string {
  if (!raw.trim()) return "—";

  try {
    const parsedJson: unknown = JSON.parse(raw);
    return JSON.stringify(parsedJson, null, 2);
  } catch {
    return raw;
  }
}

function formatDate(raw: string): string {
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? raw : DATE_FORMATTER.format(new Date(timestamp));
}
