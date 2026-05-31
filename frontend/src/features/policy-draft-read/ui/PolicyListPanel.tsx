import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePolicyList } from "../model/usePolicyList";
import type { PolicySummary } from "@/entities/policy";
import styles from "./PolicyListPanel.module.css";

interface PolicyListPanelProps {
  workspaceId: number;
  packId: number;
  versionId: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function PolicyListPanel({
  workspaceId,
  packId,
  versionId,
  selectedId,
  onSelect,
}: Readonly<PolicyListPanelProps>) {
  const [retryKey, setRetryKey] = useState(0);
  const state = usePolicyList(workspaceId, packId, versionId, retryKey);
  const errorMessage = state.status === "error" ? state.message : undefined;

  useEffect(() => {
    if (state.status === "error") {
      toast.error(errorMessage ?? "응대 기준 목록을 불러오지 못했습니다.");
    }
  }, [state.status, errorMessage]);

  return (
    <aside className={styles.panel} aria-label="응대 기준 목록">
      <header className={styles.header}>
        <span className={styles.headerTitle}>응대 기준</span>
        <span className={styles.headerMeta}>
          {state.status === "ready" ? `${state.data.length}개` : "—개"}
        </span>
      </header>

      <div className={styles.scroll}>
        <PolicyListContent
          state={state}
          selectedId={selectedId}
          onRetry={() => setRetryKey((key) => key + 1)}
          onSelect={onSelect}
        />
      </div>
    </aside>
  );
}

function PolicyListContent({
  state,
  selectedId,
  onRetry,
  onSelect,
}: Readonly<{
  state: ReturnType<typeof usePolicyList>;
  selectedId: number | null;
  onRetry: () => void;
  onSelect: (id: number) => void;
}>) {
  if (state.status === "loading") {
    return (
      <div className={styles.skeletonGroup}>
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className={styles.skeletonRow} />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={styles.emptyState}>
        <span>응대 기준 목록을 불러오지 못했습니다.</span>
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          다시 시도
        </button>
      </div>
    );
  }

  if (state.data.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span>등록된 응대 기준 초안이 없습니다.</span>
      </div>
    );
  }

  return (
    <div className={styles.listGroup}>
      {state.data.map((policy) => (
        <PolicyListRow
          key={policy.id}
          policy={policy}
          isActive={policy.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function PolicyListRow({
  policy,
  isActive,
  onSelect,
}: Readonly<{
  policy: PolicySummary;
  isActive: boolean;
  onSelect: (id: number) => void;
}>) {
  return (
    <button
      type="button"
      className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
      onClick={() => policy.id != null && onSelect(policy.id!)}
      aria-pressed={isActive}
    >
      <div className={styles.itemInner}>
        <span className={styles.code}>{policy.policyCode}</span>
        <span className={styles.name}>{policy.name}</span>
        <span className={styles.meta}>
          <span
            className={`${styles.badge} ${
              policy.status === "ACTIVE" ? styles.badgeActive : styles.badgeInactive
            }`}
          >
            {formatStatus(policy.status)}
          </span>
          <span
            className={`${styles.badge} ${
              policy.severity === "HIGH" || policy.severity === "CRITICAL"
                ? styles.badgeSeverityHigh
                : ""
            }`}
          >
            {formatSeverity(policy.severity)}
          </span>
        </span>
      </div>
    </button>
  );
}

function formatStatus(status: PolicySummary["status"]): string {
  return status === "ACTIVE" ? "사용중" : "사용 안 함";
}

function formatSeverity(severity: PolicySummary["severity"]): string {
  if (!severity) return "중요도 없음";
  const labels: Record<string, string> = {
    LOW: "낮음",
    MEDIUM: "보통",
    HIGH: "높음",
    CRITICAL: "긴급",
  };
  return labels[severity] ?? severity;
}
