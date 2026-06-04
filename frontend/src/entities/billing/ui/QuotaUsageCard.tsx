import type { QuotaUsageResponse } from "../model/types";

import styles from "./billing.module.css";

interface QuotaUsageCardProps {
  quotaUsages: QuotaUsageResponse[];
}

const QUOTA_LABELS: Record<string, string> = {
  MEMBER: "멤버",
  DATASET_UPLOAD: "Dataset 업로드",
  PIPELINE_RUN: "Pipeline 실행",
};

export function QuotaUsageCard({ quotaUsages }: QuotaUsageCardProps) {
  return (
    <section className={styles.card} aria-label="Quota 사용량">
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Quota</h2>
      </div>
      <div className={styles.quotaList}>
        {quotaUsages.map((quota, index) => (
          <QuotaUsageRow key={`${quota.resource ?? "unknown"}-${index}`} quota={quota} />
        ))}
      </div>
    </section>
  );
}

function QuotaUsageRow({ quota }: { quota: QuotaUsageResponse }) {
  const used = quota.used ?? 0;
  const limit = quota.limit ?? 0;
  const ratio = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const label = QUOTA_LABELS[quota.resource ?? ""] ?? quota.resource ?? "Quota";
  const isWarning = Boolean(quota.warning);

  return (
    <div className={isWarning ? styles.quotaRowWarning : styles.quotaRow}>
      <div className={styles.quotaMeta}>
        <span className={styles.quotaLabel}>{label}</span>
        <span className={styles.quotaValue}>
          {used} / {limit}
        </span>
      </div>
      <div className={styles.quotaTrack} aria-hidden="true">
        <span className={styles.quotaFill} style={{ width: `${ratio}%` }} />
      </div>
      {isWarning ? <p className={styles.quotaWarningText}>한도에 도달했습니다.</p> : null}
    </div>
  );
}
