import { Suspense, lazy, useState, useEffect, useId, useMemo, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { useWorkflowDetail } from "../model/useWorkflowDetail";
import { useTransitionList } from "../model/useTransitionList";
import { parseTerminalStates } from "../model/parseTerminalStates";
import { ApiRequestError, policyQueryKeys, selectApiList } from "@/shared/api";
import type { WorkflowDetail } from "@/entities/workflow";
import { useListPolicies } from "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller";
import type { PolicySummary } from "@/entities/policy";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";
import { TransitionPopover } from "./TransitionPopover";
import { TransitionListPanel } from "./TransitionListPanel";
import styles from "./WorkflowDetailPanel.module.css";

const GraphRenderer = lazy(() => import("./GraphRenderer"));

type Tab = "graph" | "json" | "meta" | "transitions";

const TABS = ["graph", "json", "meta", "transitions"] as const;
const TAB_LABELS: Record<Tab, string> = {
  graph: "흐름도",
  json: "JSON",
  meta: "상세 정보",
  transitions: "전환 조건",
};

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
  const {
    data: detail,
    isLoading,
    isError,
    error,
    refetch,
  } = useWorkflowDetail(wsId, packId, versionId, workflowId);
  const [tab, setTab] = useState<Tab>("graph");
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const idPrefix = useId();

  useEffect(() => {
    setTab("graph");
    setSelectedEdgeId(null);
  }, [workflowId]);

  const {
    data: transitionList,
    isLoading: transitionLoading,
    isError: transitionError,
    error: transitionErr,
    refetch: refetchTransitions,
  } = useTransitionList(wsId, packId, versionId, workflowId);

  const {
    data: policyList,
    isLoading: policyLoading,
    isError: policyError,
    error: policyErr,
  } = useListPolicies<PolicySummary[]>(wsId, packId, versionId, {
    query: {
      queryKey: policyQueryKeys.list(wsId, packId, versionId),
      select: selectApiList<PolicySummary>,
      enabled: workflowId != null,
    },
  });

  const policyErrorMessage =
    policyErr instanceof ApiRequestError
      ? policyErr.message
      : "응대 기준 목록을 불러오지 못했습니다.";

  useEffect(() => {
    if (!policyError) return;
    toast.error(policyErrorMessage);
  }, [policyError, policyErrorMessage]);

  const policyByCode = useMemo(
    () =>
      new Map<string, PolicySummary>(
        (policyList ?? [])
          .filter(
            (p): p is PolicySummary & { policyCode: string } => typeof p.policyCode === "string",
          )
          .map((p) => [p.policyCode, p] as [string, PolicySummary]),
      ),
    [policyList],
  );

  const selectedTransition = useMemo(
    () => transitionList?.find((t) => t.id === selectedEdgeId) ?? null,
    [transitionList, selectedEdgeId],
  );

  const selectedPolicy = useMemo(
    () =>
      selectedTransition?.toPolicyRef != null
        ? (policyByCode.get(selectedTransition.toPolicyRef) ?? null)
        : null,
    [selectedTransition, policyByCode],
  );

  const apiError = isError && error instanceof ApiRequestError ? error : null;
  const apiErrorCode = apiError?.code;
  const apiErrorStatus = apiError?.status;
  const apiErrorMessage = apiError?.message;

  useEffect(() => {
    if (!isError) return;
    const msg =
      apiErrorStatus === 404
        ? "응대 흐름을 찾을 수 없습니다."
        : apiErrorCode === "WORKFLOW_GRAPH_JSON_INVALID"
          ? "흐름도 데이터가 손상되어 표시할 수 없습니다."
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
      <section className={styles.panel} aria-label="응대 흐름 상세">
        <div className={styles.placeholder}>
          <span>좌측 목록에서 응대 흐름을 선택해 주세요.</span>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className={styles.panel} aria-label="응대 흐름 상세">
        <div className={styles.body}>
          <div className={styles.skeleton} />
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className={styles.panel} aria-label="응대 흐름 상세">
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
    <section className={styles.panel} aria-label="응대 흐름 상세">
      <DetailHeader detail={detail} onEdit={onEdit} />
      <nav className={styles.tabs} role="tablist" aria-label="응대 흐름 상세 뷰">
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
          className={`${styles.body} ${styles.graphBody}`}
        >
          <ErrorBoundary
            key={workflowId}
            fallback={
              <div className={styles.placeholder}>
                <span>그래프를 표시할 수 없습니다.</span>
              </div>
            }
          >
            <GraphContent
              detail={detail}
              onEdgeClick={setSelectedEdgeId}
              onPaneClick={() => setSelectedEdgeId(null)}
            />
          </ErrorBoundary>
          {policyLoading && (
            <div className={styles.policyStatus} role="status">
              응대 기준 목록을 불러오는 중입니다.
            </div>
          )}
          {policyError && (
            <div className={styles.policyStatus} role="alert">
              응대 기준 목록을 불러오지 못했습니다.
            </div>
          )}
          {!policyLoading && !policyError && (policyList ?? []).length === 0 && (
            <div className={styles.policyStatus}>참조할 응대 기준이 없습니다.</div>
          )}
          {selectedEdgeId !== null && selectedTransition !== null && (
            <TransitionPopover
              transition={selectedTransition}
              policy={selectedPolicy}
              onClose={() => setSelectedEdgeId(null)}
            />
          )}
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

      {tab === "transitions" && (
        <div
          id={`${idPrefix}-panel-transitions`}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-tab-transitions`}
          className={styles.body}
        >
          <TransitionListPanel
            transitions={transitionList}
            isLoading={transitionLoading}
            isError={transitionError}
            error={transitionErr}
            refetch={refetchTransitions}
          />
        </div>
      )}
    </section>
  );
}

function GraphContent({
  detail,
  onEdgeClick,
  onPaneClick,
}: {
  detail: WorkflowDetail;
  onEdgeClick: (id: string) => void;
  onPaneClick: () => void;
}) {
  const graphJson = detail.graphJson;
  if (graphJson == null) {
    return (
      <div className={styles.placeholder}>
        <span>흐름도 데이터 없음</span>
      </div>
    );
  }
  const graph: import("@/entities/workflow").WorkflowGraph =
    typeof graphJson === "string" ? JSON.parse(graphJson) : graphJson;
  return (
    <Suspense fallback={<div className={styles.skeleton} />}>
      <GraphRenderer graph={graph} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick} />
    </Suspense>
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
          <span className={styles.updatedAt}>
            수정일 · {detail.updatedAt ? new Date(detail.updatedAt).toLocaleString() : "—"}
          </span>
        </div>
        {onEdit && (
          <button type="button" className={styles.editButton} onClick={onEdit}>
            수정
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
  const terminals = parseTerminalStates(detail.terminalStatesJson ?? "");
  return (
    <div className={styles.metaSection}>
      <div className={styles.metaItem}>
        <span className={styles.metaLabel}>시작 상태</span>
        {detail.initialState ? (
          <span className={styles.badge}>{detail.initialState}</span>
        ) : (
          <span>—</span>
        )}
      </div>
      <div className={styles.metaItem}>
        <span className={styles.metaLabel}>종료 상태</span>
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
        <span className={styles.metaLabel}>근거 로그</span>
        <pre className={styles.rawCode}>
          <code>{formatJsonForDisplay(detail.evidenceJson ?? "")}</code>
        </pre>
      </div>
      <div className={styles.metaItem}>
        <span className={styles.metaLabel}>추가 정보</span>
        <pre className={styles.rawCode}>
          <code>{formatJsonForDisplay(detail.metaJson ?? "")}</code>
        </pre>
      </div>
    </div>
  );
}
