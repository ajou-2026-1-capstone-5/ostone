import { Suspense, lazy, useState, useEffect, useId, useMemo, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { useWorkflowDetail } from "../model/useWorkflowDetail";
import { parseTerminalStates } from "../model/parseTerminalStates";
import { ApiRequestError } from "@/shared/api";
import type { WorkflowDetail } from "@/entities/workflow";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";
import styles from "./WorkflowDetailPanel.module.css";

const GraphRenderer = lazy(() => import("./GraphRenderer"));

type Tab = "graph" | "json" | "meta";

const TABS = ["graph", "json", "meta"] as const;
const TAB_LABELS: Record<Tab, string> = { graph: "Graph", json: "JSON", meta: "Meta" };

interface WorkflowDetailPanelProps {
  wsId: number;
  packId: number;
  versionId: number;
  workflowId: number | null;
  onEdit?: () => void;
}

export function WorkflowDetailPanel({
  wsId,
  packId,
  versionId,
  workflowId,
  onEdit,
}: WorkflowDetailPanelProps) {
  const { data: detail, isLoading, isError, error, refetch } = useWorkflowDetail(wsId, packId, versionId, workflowId);
  const [tab, setTab] = useState<Tab>("graph");
  const idPrefix = useId();

  useEffect(() => {
    setTab("graph");
  }, [workflowId]);

  const apiError = isError && error instanceof ApiRequestError ? error : null;
  const apiErrorCode = apiError?.code;
  const apiErrorStatus = apiError?.status;
  const apiErrorMessage = apiError?.message;

  useEffect(() => {
    if (!isError) return;
    const msg =
      apiErrorStatus === 404
        ? "workflow를 찾을 수 없습니다."
        : apiErrorCode === "WORKFLOW_GRAPH_JSON_INVALID"
          ? "graph 데이터가 손상되어 시각화를 표시할 수 없습니다."
          : apiErrorMessage || "상세 정보를 불러오지 못했습니다.";
    toast.error(msg);
  }, [isError, apiErrorCode, apiErrorStatus, apiErrorMessage]);

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(TABS[next]);
    document.getElementById(`${idPrefix}-tab-${TABS[next]}`)?.focus();
  };

  const jsonText = useMemo(() => JSON.stringify(detail?.graphJson, null, 2), [detail?.graphJson]);

  if (workflowId === null) {
    return (
      <section className={styles.panel} aria-label="workflow 상세">
        <div className={styles.placeholder}>
          <span>좌측 목록에서 workflow를 선택해 주세요.</span>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className={styles.panel} aria-label="workflow 상세">
        <div className={styles.body}>
          <div className={styles.skeleton} />
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className={styles.panel} aria-label="workflow 상세">
        <div className={styles.placeholder}>
          <span>상세 정보를 불러오지 못했습니다.</span>
          <button type="button" className={styles.retryButton} onClick={() => void refetch()}>
            다시 시도
          </button>
        </div>
      </section>
    );
  }

  if (!detail) return null;

  return (
    <section className={styles.panel} aria-label="workflow 상세">
      <DetailHeader detail={detail} onEdit={onEdit} />
      <nav className={styles.tabs} role="tablist" aria-label="workflow 상세 뷰">
        {TABS.map((t, i) => (
          <button
            key={t}
            id={`${idPrefix}-tab-${t}`}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls={`${idPrefix}-panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
            onKeyDown={(e) => handleTabKeyDown(e, i)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      {tab === "graph" && (
        <div
          id={`${idPrefix}-panel-graph`}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-tab-graph`}
          className={styles.body}
        >
          <ErrorBoundary key={workflowId} fallback={<div className={styles.placeholder}><span>그래프를 표시할 수 없습니다.</span></div>}>
            <Suspense fallback={<div className={styles.skeleton} />}>
              <GraphRenderer graph={detail.graphJson} />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {tab === "json" && (
        <div
          id={`${idPrefix}-panel-json`}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-tab-json`}
          className={styles.body}
        >
          <pre className={styles.jsonBlock}>
            <code>{jsonText}</code>
          </pre>
        </div>
      )}

      {tab === "meta" && (
        <div
          id={`${idPrefix}-panel-meta`}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-tab-meta`}
          className={styles.body}
        >
          <MetaTab detail={detail} />
        </div>
      )}
    </section>
  );
}

function DetailHeader({ detail, onEdit }: { detail: WorkflowDetail; onEdit?: () => void }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerRow}>
        <div className={styles.headerInfo}>
          <span className={styles.code}>{detail.workflowCode}</span>
          <span className={styles.name}>{detail.name}</span>
          {detail.description && <span className={styles.description}>{detail.description}</span>}
          <span className={styles.updatedAt}>UPDATED · {new Date(detail.updatedAt).toLocaleString()}</span>
        </div>
        {onEdit && (
          <button type="button" className={styles.editButton} onClick={onEdit}>
            Edit
          </button>
        )}
      </div>
    </header>
  );
}

function formatJsonForDisplay(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function MetaTab({ detail }: { detail: WorkflowDetail }) {
  const terminals = parseTerminalStates(detail.terminalStatesJson);
  return (
    <div className={styles.metaSection}>
      <div className={styles.metaItem}>
        <span className={styles.metaLabel}>Initial State</span>
        {detail.initialState ? (
          <span className={styles.badge}>{detail.initialState}</span>
        ) : (
          <span>—</span>
        )}
      </div>
      <div className={styles.metaItem}>
        <span className={styles.metaLabel}>Terminal States</span>
        {terminals.ok ? (
          terminals.value.length === 0 ? (
            <span>—</span>
          ) : (
            <div className={styles.badgeRow}>
              {terminals.value.map((t) => (
                <span key={t} className={styles.badge}>
                  {t}
                </span>
              ))}
            </div>
          )
        ) : (
          <code className={styles.rawCode}>{terminals.raw}</code>
        )}
      </div>
      <div className={styles.metaItem}>
        <span className={styles.metaLabel}>Evidence (raw)</span>
        <pre className={styles.rawCode}>
          <code>{formatJsonForDisplay(detail.evidenceJson)}</code>
        </pre>
      </div>
      <div className={styles.metaItem}>
        <span className={styles.metaLabel}>Meta (raw)</span>
        <pre className={styles.rawCode}>
          <code>{formatJsonForDisplay(detail.metaJson)}</code>
        </pre>
      </div>
    </div>
  );
}
