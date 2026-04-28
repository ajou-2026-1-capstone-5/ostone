import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RISK_READ_ERROR_MESSAGES } from "../model/mapApiError";
import { useRiskList } from "../model/useRiskList";
import type { RiskSummary } from "@/entities/risk";
import styles from "./RiskListPanel.module.css";

const SKELETON_ROWS = ["risk-skeleton-1", "risk-skeleton-2", "risk-skeleton-3"] as const;

interface RiskListPanelProps {
  workspaceId: number;
  packId: number;
  versionId: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function RiskListPanel({
  workspaceId,
  packId,
  versionId,
  selectedId,
  onSelect,
}: Readonly<RiskListPanelProps>) {
  const [retryKey, setRetryKey] = useState(0);
  const state = useRiskList(workspaceId, packId, versionId, retryKey);
  const errorMessage = state.status === "error" ? state.message : undefined;

  useEffect(() => {
    if (state.status === "error") {
      toast.error(errorMessage ?? RISK_READ_ERROR_MESSAGES.LOAD_LIST_FAILED);
    }
  }, [state.status, errorMessage]);

  return (
    <aside className={styles.panel} aria-label="위험요소 목록">
      <header className={styles.header}>
        <span className={styles.headerTitle}>Risks</span>
        <span className={styles.headerMeta}>
          {state.status === "ready"
            ? `${state.data.length} · LIST`
            : state.status === "empty"
              ? "0 · LIST"
              : "— · LIST"}
        </span>
      </header>

      <div className={styles.scroll}>
        <RiskListContent
          state={state}
          selectedId={selectedId}
          onRetry={() => setRetryKey((key) => key + 1)}
          onSelect={onSelect}
        />
      </div>
    </aside>
  );
}

function RiskListContent({
  state,
  selectedId,
  onRetry,
  onSelect,
}: Readonly<{
  state: ReturnType<typeof useRiskList>;
  selectedId: number | null;
  onRetry: () => void;
  onSelect: (id: number) => void;
}>) {
  if (state.status === "loading") {
    return <RiskLoadingRows />;
  }

  if (state.status === "error" || state.status === "empty") {
    const message =
      state.status === "error"
        ? RISK_READ_ERROR_MESSAGES.LOAD_LIST_FAILED
        : "등록된 위험요소 초안이 없습니다.";

    return (
      <RiskListMessage
        message={message}
        retryLabel={state.status === "error" ? "다시 시도" : undefined}
        onRetry={state.status === "error" ? onRetry : undefined}
      />
    );
  }

  return (
    <div className={styles.listGroup}>
      {state.data.map((risk) => (
        <RiskListRow
          key={risk.id}
          risk={risk}
          isActive={risk.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function RiskLoadingRows() {
  return (
    <div className={styles.skeletonGroup} aria-busy="true">
      {SKELETON_ROWS.map((rowKey) => (
        <div key={rowKey} className={styles.skeletonRow} />
      ))}
    </div>
  );
}

function RiskListMessage({
  message,
  retryLabel,
  onRetry,
}: Readonly<{
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}>) {
  return (
    <div className={styles.emptyState}>
      <span>{message}</span>
      {retryLabel && (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

function RiskListRow({
  risk,
  isActive,
  onSelect,
}: Readonly<{
  risk: RiskSummary;
  isActive: boolean;
  onSelect: (id: number) => void;
}>) {
  return (
    <button
      type="button"
      className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
      onClick={() => onSelect(risk.id)}
      aria-current={isActive ? "true" : undefined}
    >
      <div className={styles.itemInner}>
        <span className={styles.code}>{risk.riskCode}</span>
        <span className={styles.name}>{risk.name}</span>
        <span className={styles.meta}>
          <span
            className={`${styles.badge} ${
              risk.status === "ACTIVE" ? styles.badgeActive : styles.badgeInactive
            }`}
          >
            {risk.status === "ACTIVE" ? "● ACTIVE" : "○ INACTIVE"}
          </span>
          <span
            className={`${styles.badge} ${
              risk.riskLevel === "HIGH" || risk.riskLevel === "CRITICAL"
                ? styles.badgeRiskLevelHigh
                : ""
            }`}
          >
            {risk.riskLevel}
          </span>
        </span>
      </div>
    </button>
  );
}
