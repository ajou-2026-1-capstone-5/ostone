import { Suspense, lazy, useState } from "react";
import { useWorkflowDetail } from "../model/useWorkflowDetail";
import { parseTerminalStates } from "../model/parseTerminalStates";
import type { WorkflowDetail } from "../../../entities/workflow";
import styles from "./WorkflowDetailPanel.module.css";

const GraphRenderer = lazy(() => import("./GraphRenderer"));

type Tab = "graph" | "json" | "meta";

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
        <div className={styles.stateMessage} role="alert">
          <span className={styles.errorCode}>{state.code}</span>
          <span>
            {state.httpStatus === 404
              ? "workflow를 찾을 수 없습니다."
              : state.code === "WORKFLOW_GRAPH_JSON_INVALID"
                ? "graphJson이 손상되어 시각화를 표시할 수 없습니다."
                : state.message || "상세 정보를 불러오지 못했습니다."}
          </span>
        </div>
      </section>
    );
  }

  const detail = state.data;

  return (
    <section className={styles.panel} aria-label="workflow 상세">
      <DetailHeader detail={detail} />
      <nav className={styles.tabs} role="tablist" aria-label="workflow 상세 뷰">
        {(["graph", "json", "meta"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "graph" ? "Graph" : t === "json" ? "JSON" : "Meta"}
          </button>
        ))}
      </nav>

      <div className={styles.body} role="tabpanel">
        {tab === "graph" && (
          <Suspense fallback={<div className={styles.skeleton} />}>
            <GraphRenderer graph={detail.graphJson} />
          </Suspense>
        )}
        {tab === "json" && (
          <pre className={styles.jsonBlock}>
            <code>{JSON.stringify(detail.graphJson, null, 2)}</code>
          </pre>
        )}
        {tab === "meta" && <MetaTab detail={detail} />}
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
        {Array.isArray(terminals) ? (
          terminals.length === 0 ? (
            <span>—</span>
          ) : (
            <div className={styles.badgeRow}>
              {terminals.map((t) => (
                <span key={t} className={styles.badge}>
                  {t}
                </span>
              ))}
            </div>
          )
        ) : (
          <code className={styles.rawCode}>{terminals}</code>
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
