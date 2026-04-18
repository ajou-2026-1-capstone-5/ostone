import { useEffect } from "react";
import { toast } from "sonner";
import { useWorkflowList } from "../model/useWorkflowList";
import { parseTerminalStates } from "../model/parseTerminalStates";
import type { WorkflowSummary } from "../../../entities/workflow";
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
  return Array.isArray(parsed) ? parsed.length : null;
}

export function WorkflowListPanel({
  wsId,
  packId,
  versionId,
  selectedId,
  onSelect,
}: WorkflowListPanelProps) {
  const state = useWorkflowList(wsId, packId, versionId);
  const errorHttpStatus = state.status === "error" ? state.httpStatus : undefined;

  useEffect(() => {
    if (state.status === "error" && errorHttpStatus === 403) {
      toast.error("접근 권한 없음");
    }
  }, [state.status, errorHttpStatus]);

  return (
    <aside className={styles.panel} aria-label="workflow 목록">
      <header className={styles.header}>
        <span className={styles.headerTitle}>Workflows</span>
        <span className={styles.headerMeta}>
          {state.status === "ready" ? `${state.data.length} · CODE` : "— · CODE"}
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
          <div className={styles.errorState} role="alert">
            <span className={styles.errorCode}>{state.code}</span>
            <span>{state.message || "목록을 불러오지 못했습니다."}</span>
          </div>
        )}

        {state.status === "ready" && state.data.length === 0 && (
          <div className={styles.emptyState}>
            <span>해당 버전에 등록된 workflow 초안이 없습니다.</span>
          </div>
        )}

        {state.status === "ready" &&
          state.data.map((w) => (
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
