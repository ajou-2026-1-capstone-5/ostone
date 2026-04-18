import { Suspense, lazy, useState, useEffect } from 'react';
import { AlertCircle, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkflowDetail } from '../model/useWorkflowDetail';
import { parseTerminalStates } from '../model/parseTerminalStates';
import styles from './workflow-detail-panel.module.css';

const GraphRenderer = lazy(() => import('./GraphRenderer'));

type Tab = 'graph' | 'json' | 'meta';

interface WorkflowDetailPanelProps {
  wsId: number;
  packId: number;
  versionId: number;
  workflowId: number | null;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function tryParseJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch (e) {
    console.warn('[tryParseJson] JSON parsing failed');
    return null;
  }
}

export function WorkflowDetailPanel({
  wsId,
  packId,
  versionId,
  workflowId,
}: WorkflowDetailPanelProps) {
  const [tab, setTab] = useState<Tab>('graph');
  const detailState = useWorkflowDetail(wsId, packId, versionId, workflowId);
  const errorCode = detailState.status === 'error' ? detailState.code : undefined;

  useEffect(() => {
    if (detailState.status === 'error' && errorCode !== 'WORKFLOW_DEFINITION_NOT_FOUND') {
      toast.error(detailState.message);
    }
  // discriminated-union: status/errorCode always change together; message intentionally omitted
  }, [detailState.status, errorCode]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (workflowId === null) {
    return (
      <div className={styles.panel}>
        <div className={styles.placeholder}>
          <GitBranch size={40} className={styles.placeholderIcon} />
          <p className={styles.placeholderText}>좌측에서 workflow를 선택하세요</p>
        </div>
      </div>
    );
  }

  if (detailState.status === 'loading') {
    return (
      <div className={styles.panel}>
        <div className={styles.loadingState} role="status" aria-label="Loading workflow details">
          <div className={styles.spinnerRow}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className={styles.skeletonBlock} style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (detailState.status === 'error') {
    if (detailState.code !== 'WORKFLOW_DEFINITION_NOT_FOUND') {
      return <div className={styles.panel} />;
    }
    return (
      <div className={styles.panel}>
        <div className={styles.errorState}>
          <AlertCircle size={36} className={styles.errorIcon} />
          <p className={styles.errorTitle}>Workflow를 찾을 수 없습니다</p>
          <p className={styles.errorMessage}>{detailState.message}</p>
        </div>
      </div>
    );
  }

  if (detailState.status !== 'ready') return null;

  const { data } = detailState;
  const terminalStates = parseTerminalStates(data.terminalStatesJson);
  const evidenceParsed = tryParseJson(data.evidenceJson);
  const metaParsed = tryParseJson(data.metaJson);

  return (
    <div className={styles.panel}>
      <div className={styles.detailHeader}>
        <div className={styles.headerTop}>
          <span className={styles.workflowCode}>{data.workflowCode}</span>
          <span className={styles.updatedAt}>수정: {formatDate(data.updatedAt)}</span>
        </div>
        <h2 className={styles.workflowName}>{data.name}</h2>
        {data.description && (
          <p className={styles.description}>{data.description}</p>
        )}
      </div>

      <div
        className={styles.tabs}
        role="tablist"
        onKeyDown={(e) => {
          const allTabs: Tab[] = ['graph', 'json', 'meta'];
          const idx = allTabs.indexOf(tab);
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const dir = e.key === 'ArrowRight' ? 1 : -1;
            const next = (idx + dir + allTabs.length) % allTabs.length;
            setTab(allTabs[next]);
            const tabList = e.currentTarget;
            (tabList.querySelectorAll('[role="tab"]')[next] as HTMLButtonElement)?.focus();
          }
        }}
      >
        {(['graph', 'json', 'meta'] as Tab[]).map((t) => (
          <button
            key={t}
            id={`tab-${t}`}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
            role="tab"
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
          >
            {t === 'graph' ? 'Graph' : t === 'json' ? 'JSON' : 'Meta'}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {tab === 'graph' && (
          <div role="tabpanel" id="panel-graph" aria-labelledby="tab-graph" tabIndex={0}>
            <Suspense fallback={<div className={styles.graphLoading}>그래프 로드 중...</div>}>
              <GraphRenderer graph={data.graphJson} />
            </Suspense>
          </div>
        )}

        {tab === 'json' && (
          <div role="tabpanel" id="panel-json" aria-labelledby="tab-json" tabIndex={0} className={styles.jsonView}>
            <pre className={styles.jsonPre}>
              <code>{JSON.stringify(data.graphJson, null, 2)}</code>
            </pre>
          </div>
        )}

        {tab === 'meta' && (
          <div role="tabpanel" id="panel-meta" aria-labelledby="tab-meta" tabIndex={0} className={styles.metaView}>
            <section className={styles.metaSection}>
              <h3 className={styles.metaSectionTitle}>초기 상태</h3>
              <p className={styles.metaValue}>{data.initialState ?? '—'}</p>
            </section>

            <section className={styles.metaSection}>
              <h3 className={styles.metaSectionTitle}>종료 상태</h3>
              {Array.isArray(terminalStates) ? (
                <div className={styles.tagList}>
                  {terminalStates.length === 0 ? (
                    <span className={styles.metaMuted}>없음</span>
                  ) : (
                    terminalStates.map((s, i) => (
                      <span key={i} className={styles.tag}>{s}</span>
                    ))
                  )}
                </div>
              ) : (
                <code className={styles.rawCode}>{terminalStates}</code>
              )}
            </section>

            <section className={styles.metaSection}>
              <h3 className={styles.metaSectionTitle}>Evidence</h3>
              {evidenceParsed !== null ? (
                <pre className={styles.metaPre}>
                  <code>{JSON.stringify(evidenceParsed, null, 2)}</code>
                </pre>
              ) : (
                <code className={styles.rawCode}>{data.evidenceJson}</code>
              )}
            </section>

            <section className={styles.metaSection}>
              <h3 className={styles.metaSectionTitle}>Meta</h3>
              {metaParsed !== null ? (
                <pre className={styles.metaPre}>
                  <code>{JSON.stringify(metaParsed, null, 2)}</code>
                </pre>
              ) : (
                <code className={styles.rawCode}>{data.metaJson}</code>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}