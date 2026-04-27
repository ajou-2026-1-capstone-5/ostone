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
}: PolicyListPanelProps) {
  const [retryKey, setRetryKey] = useState(0);
  const state = usePolicyList(workspaceId, packId, versionId, retryKey);
  const errorMessage = state.status === "error" ? state.message : undefined;

  useEffect(() => {
    if (state.status === "error") {
      toast.error(errorMessage ?? "정책 목록을 불러오지 못했습니다.");
    }
  }, [state.status, errorMessage]);

  return (
    <aside className={styles.panel} aria-label="정책 목록">
      <header className={styles.header}>
        <span className={styles.headerTitle}>Policies</span>
        <span className={styles.headerMeta}>
          {state.status === "ready" ? `${state.data.length} · LIST` : "— · LIST"}
        </span>
      </header>

      <div className={styles.scroll}>
        {state.status === "loading" && (
          <div className={styles.skeletonGroup}>
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
          </div>
        )}

        {state.status === "error" && (
          <div className={styles.emptyState}>
            <span>정책 목록을 불러오지 못했습니다.</span>
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => setRetryKey((key) => key + 1)}
            >
              다시 시도
            </button>
          </div>
        )}

        {state.status === "ready" && state.data.length === 0 && (
          <div className={styles.emptyState}>
            <span>등록된 정책 초안이 없습니다.</span>
          </div>
        )}

        {state.status === "ready" && state.data.length > 0 && (
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
        )}
      </div>
    </aside>
  );
}

function PolicyListRow({
  policy,
  isActive,
  onSelect,
}: {
  policy: PolicySummary;
  isActive: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
      onClick={() => onSelect(policy.id)}
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
            {policy.status === "ACTIVE" ? "● ACTIVE" : "○ INACTIVE"}
          </span>
          <span
            className={`${styles.badge} ${
              policy.severity === "HIGH" || policy.severity === "CRITICAL"
                ? styles.badgeSeverityHigh
                : ""
            }`}
          >
            {policy.severity ?? "NO SEVERITY"}
          </span>
        </span>
      </div>
    </button>
  );
}
