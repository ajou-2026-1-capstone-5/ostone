import { Suspense, lazy, useState, useEffect, useId } from "react";
import { toast } from "sonner";
import { useWorkflowDetail } from "../model/useWorkflowDetail";
import { parseTerminalStates } from "../model/parseTerminalStates";
import type { WorkflowDetail } from "../../../entities/workflow";
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
}

export function WorkflowDetailPanel({
  wsId,
  packId,
  versionId,
  workflowId,
}: WorkflowDetailPanelProps) {
  const state = useWorkflowDetail(wsId, packId, versionId, workflowId);
  const [tab, setTab] = useState<Tab>("graph");
  const idPrefix = useId();

  useEffect(() => {
    setTab("graph");
  }, [workflowId]);

  const errorCode = state.status === "error" ? state.code : undefined;
  const errorHttpStatus = state.status === "error" ? state.httpStatus : undefined;
  const errorMessage = state.status === "error" ? state.message : undefined;

  useEffect(() => {
    if (state.status !== "error") return;
    const msg =
      errorHttpStatus === 404
        ? "workflow를 찾을 수 없습니다."
        : errorCode === "WORKFLOW_GRAPH_JSON_INVALID"
          ? "graph 데이터가 손상되어 시각화를 표시할 수 없습니다."
          : errorMessage || "상세 정보를 불러오지 못했습니다.";
    toast.error(msg);
  }, [state.status, errorCode, errorHttpStatus, errorMessage]);

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
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

  if (state.status === "idle") {
    return (
      <section className={styles.panel} aria-label="workflow 상세">
        <div className={styles.placeholder}>
          <span>좌측 목록에서 workflow를 선택해 주세요.</span>
        </div>
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section className={styles.panel} aria-label="workflow 상세">
        <div className={styles.body}>
          <div className={styles.skeleton} />
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.panel} aria-label="workflow 상세">
        <div className={styles.placeholder}>
          <span>상세 정보를 불러오지 못했습니다.</span>
        </div>
      </section>
    );
  }

  const detail = state.data;

  return (
    <section className={styles.panel} aria-label="workflow 상세">
      <DetailHeader detail={detail} />
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

      <div
        id={`${idPrefix}-panel-graph`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-graph`}
        className={styles.body}
        hidden={tab !== "graph"}
      >
        <Suspense fallback={<div className={styles.skeleton} />}>
          <GraphRenderer graph={detail.graph} />
        </Suspense>
      </div>

      <div
        id={`${idPrefix}-panel-json`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-json`}
        className={styles.body}
        hidden={tab !== "json"}
      >
        <pre className={styles.jsonBlock}>
          <code>{JSON.stringify(detail.graph, null, 2)}</code>
        </pre>
      </div>

      <div
        id={`${idPrefix}-panel-meta`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-meta`}
        className={styles.body}
        hidden={tab !== "meta"}
      >
        <MetaTab detail={detail} />
      </div>
    </section>
  );
}

function DetailHeader({ detail }: { detail: WorkflowDetail }) {
  return (
    <header className={styles.header}>
      <span className={styles.code}>{detail.workflowCode}</span>
      <span className={styles.name}>{detail.name}</span>
      {detail.description && <span className={styles.description}>{detail.description}</span>}
      <span className={styles.updatedAt}>UPDATED · {detail.updatedAt}</span>
    </header>
  );
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
        <code className={styles.rawCode}>{detail.evidenceJson}</code>
      </div>
      <div className={styles.metaItem}>
        <span className={styles.metaLabel}>Meta (raw)</span>
        <code className={styles.rawCode}>{detail.metaJson}</code>
      </div>
    </div>
  );
}
