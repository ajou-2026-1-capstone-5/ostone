import { useEffect } from "react";
import { toast } from "sonner";
import { useWorkflowList } from "../model/useWorkflowList";
import { parseTerminalStates } from "../model/parseTerminalStates";
import { ApiRequestError } from "@/shared/api";
import type { WorkflowSummary } from "@/entities/workflow";
import styles from "./WorkflowListPanel.module.css";

interface WorkflowListPanelProps {
  wsId: number;
  packId: number;
  versionId: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function terminalCount(json: string): number | null {
  const parsed = parseTerminalStates(json);
  return parsed.ok ? parsed.value.length : null;
}

export function WorkflowListPanel({
  wsId,
  packId,
  versionId,
  selectedId,
  onSelect,
}: WorkflowListPanelProps) {
  const { data, isLoading, isError, isSuccess, error, refetch } = useWorkflowList(wsId, packId, versionId);
  const errorMessage = isError && error instanceof ApiRequestError ? error.message : undefined;

  useEffect(() => {
    if (isError) {
      toast.error(errorMessage ?? "목록을 불러오지 못했습니다.");
    }
  }, [isError, errorMessage]);

  return (
    <aside className={styles.panel} aria-label="workflow 목록">
      <header className={styles.header}>
        <span className={styles.headerTitle}>Workflows</span>
        <span className={styles.headerMeta}>
          {isSuccess ? `${data.length} · CODE` : "— · CODE"}
        </span>
      </header>

      <div className={styles.scroll}>
        {isLoading && (
          <div className={styles.skeletonGroup}>
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
          </div>
        )}

        {isError && (
          <div className={styles.errorState}>
            <span>목록을 불러오지 못했습니다.</span>
            <button type="button" className={styles.retryButton} onClick={() => void refetch()}>
              다시 시도
            </button>
          </div>
        )}

        {isSuccess && data.length === 0 && (
          <div className={styles.emptyState}>
            <span>해당 버전에 등록된 workflow 초안이 없습니다.</span>
          </div>
        )}

        {isSuccess &&
          data.map((w) => (
            <WorkflowRow key={w.id} workflow={w} active={w.id === selectedId} onSelect={onSelect} />
          ))}
      </div>
    </aside>
  );
}

function WorkflowRow({
  workflow,
  active,
  onSelect,
}: {
  workflow: WorkflowSummary;
  active: boolean;
  onSelect: (id: number) => void;
}) {
  const tCount = terminalCount(workflow.terminalStatesJson);
  return (
    <button
      type="button"
      className={`${styles.item} ${active ? styles.itemActive : ""}`}
      onClick={() => onSelect(workflow.id)}
      aria-current={active ? "true" : undefined}
    >
      <span className={styles.code}>{workflow.workflowCode}</span>
      <span className={styles.name}>{workflow.name}</span>
      <span className={styles.badges}>
        {workflow.initialState && (
          <span className={styles.badge}>INIT · {workflow.initialState}</span>
        )}
        <span className={styles.badge}>TERM · {tCount === null ? "?" : tCount}</span>
      </span>
    </button>
  );
}
