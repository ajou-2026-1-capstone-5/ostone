import { useMemo } from 'react';
import { ChatWorkflowHeader } from './ChatWorkflowHeader';
import { ExecutionDetailPanel } from './ExecutionDetailPanel';
import { DecisionLogDrawer } from './DecisionLogDrawer';
import { adaptDemoWorkflow } from '../lib/workflowAdapter';
import { getNodeIdsByMessageId } from '../lib/messageNodeMapping';
import styles from './chat-workflow-demo.module.css';
import type {
  DemoWorkflow,
  DemoExecution,
  DemoDecisionLogEntry,
  DemoDomainPack,
  DemoChatMessage,
} from '../model/chatWorkflow.types';

export interface SidePanelProps {
  readonly workflow: DemoWorkflow;
  readonly execution: DemoExecution | null;
  readonly decisionLogs: DemoDecisionLogEntry[];
  readonly selectedMessageId: string | null;
  readonly activeMessageId?: string | null;
  readonly messages: DemoChatMessage[];
  readonly domainPack: DemoDomainPack | null;
  readonly onNodeSelect?: (nodeId: string) => void;
}

const STATE_LABELS: Record<string, string> = {
  INITIAL: '상담 시작',
  IDENTITY_VERIFICATION: '본인 확인',
  INTENT_DETECTED: '의도 감지',
  SLOT_COLLECTING: '조건 수집',
  PAYMENT_INFO_COLLECTING: '결제 정보 수집',
  AVAILABILITY_CHECKING: '가능 여부 확인',
  USAGE_HISTORY_SEARCHING: '이용내역 조회',
  MISMATCH_ANALYSIS: '불일치 확인',
  ALTERNATIVE_OFFERING: '대안 제안',
  RESERVATION_GUIDE: '예약 안내',
  EVIDENCE_REQUESTING: '증빙 요청',
  DEPARTMENT_ESCALATION: '부서 확인',
  CALLBACK_GUIDE: '콜백 안내',
  PICKUP_GUIDE: '픽업 안내',
  BENEFIT_GUIDE: '혜택 안내',
  COMPLETED: '상담 완료',
  HANDOFF: '사람 이관',
  HANDED_OFF: '사람 이관',
};

function stateLabel(state: string): string {
  return STATE_LABELS[state] ?? state.replaceAll('_', ' ').toLowerCase();
}

function roleLabel(role: DemoChatMessage['role']): string {
  return role === 'user' ? 'Customer' : 'Agent';
}

function formatTime(isoString: string): string {
  return new Date(isoString).toISOString().substring(11, 16);
}

function getTurnNumber(messageId: string, messages: DemoChatMessage[]): number | null {
  const index = messages.findIndex((message) => message.id === messageId);
  return index >= 0 ? index + 1 : null;
}

function formatConfidence(value: number): string {
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

const DIAGRAM_WIDTH = 1000;
const DIAGRAM_HEIGHT = 360;
const NODE_WIDTH = 150;
const NODE_HEIGHT = 72;
const CONNECTOR_GAP = 12;
const DIAGRAM_COLUMNS = 5;
const COLUMN_X = [90, 295, 500, 705, 910];
const ROW_Y = [92, 232];
const EXCEPTION_Y = 322;

function isExceptionState(state: string): boolean {
  return state === 'HANDED_OFF' || state === 'HANDOFF';
}

interface DiagramPosition {
  state: string;
  x: number;
  y: number;
}

function getMainPosition(state: string, index: number): DiagramPosition {
  const row = Math.floor(index / DIAGRAM_COLUMNS);
  const rawColumn = index % DIAGRAM_COLUMNS;
  const column = row % 2 === 0 ? rawColumn : DIAGRAM_COLUMNS - 1 - rawColumn;

  return {
    state,
    x: COLUMN_X[column] ?? COLUMN_X.at(-1)!,
    y: ROW_Y[row] ?? ROW_Y.at(-1)!,
  };
}

function connectorPath(from: DiagramPosition, to: DiagramPosition): string {
  if (from.y === to.y) {
    const movingRight = to.x > from.x;
    const startX = from.x + (movingRight ? NODE_WIDTH / 2 + CONNECTOR_GAP : -NODE_WIDTH / 2 - CONNECTOR_GAP);
    const endX = to.x + (movingRight ? -NODE_WIDTH / 2 - CONNECTOR_GAP : NODE_WIDTH / 2 + CONNECTOR_GAP);
    return `M ${startX} ${from.y} L ${endX} ${to.y}`;
  }

  const startY = from.y + NODE_HEIGHT / 2 + CONNECTOR_GAP;
  const endY = to.y - NODE_HEIGHT / 2 - CONNECTOR_GAP;
  const midY = startY + (endY - startY) / 2;
  return `M ${from.x} ${startY} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${endY}`;
}

function WorkflowOverview({
  workflow,
  currentState,
  selectedNodeIds,
  messages,
  decisionLogs,
  onNodeSelect,
}: Readonly<{
  workflow: DemoWorkflow;
  currentState?: string;
  selectedNodeIds: readonly string[];
  messages: DemoChatMessage[];
  decisionLogs: DemoDecisionLogEntry[];
  onNodeSelect?: (nodeId: string) => void;
}>) {
  const exceptionStates = workflow.states.filter(isExceptionState);
  const mainStates = workflow.states.filter((state) => !isExceptionState(state));
  const mainPositions = mainStates.map((state, index) => getMainPosition(state, index));
  const positionByState = new Map(mainPositions.map((position) => [position.state, position]));
  const exceptionPositions: DiagramPosition[] = exceptionStates.map((state, index) => ({
    state,
    x: 760 + index * 150,
    y: EXCEPTION_Y,
  }));
  const exceptionPositionByState = new Map(exceptionPositions.map((position) => [position.state, position]));
  const allPositionsByState = new Map([...positionByState, ...exceptionPositionByState]);
  const transitionConnectors = workflow.transitions
    .map((transition, index) => {
      const from = allPositionsByState.get(transition.from);
      const to = allPositionsByState.get(transition.to);
      if (!from || !to) return null;

      const isException = isExceptionState(transition.from) || isExceptionState(transition.to);
      return {
        id: `${transition.from}-${transition.to}-${index}`,
        isException,
        path: isException
          ? `M ${from.x} ${from.y + NODE_HEIGHT / 2 + CONNECTOR_GAP} C ${from.x} ${from.y + 86}, ${to.x} ${to.y - 86}, ${to.x} ${to.y - NODE_HEIGHT / 2 - CONNECTOR_GAP}`
          : connectorPath(from, to),
      };
    })
    .filter((connector): connector is { id: string; path: string; isException: boolean } => connector !== null);
  const selectedSet = new Set(selectedNodeIds);
  const turnNumbersByState = new Map<string, number[]>();
  for (const log of decisionLogs) {
    const turnNumber = getTurnNumber(log.messageId, messages);
    if (turnNumber === null) continue;

    const turns = turnNumbersByState.get(log.stateTo) ?? [];
    if (!turns.includes(turnNumber)) {
      turns.push(turnNumber);
    }
    turnNumbersByState.set(log.stateTo, turns);
  }

  return (
    <div className={styles.workflowMap}>
      <div className={styles.workflowMapHeader}>
        <span className={styles.eyebrow}>State Flow</span>
        <span className={styles.count}>{workflow.transitions.length} transitions</span>
      </div>
      <div className={styles.diagramCanvas}>
        <svg
          className={styles.diagramSvg}
          viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <marker
              id="workflow-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          {transitionConnectors.map((connector) => (
            <path
              key={connector.id}
              d={connector.path}
              className={connector.isException ? styles.diagramExceptionConnector : styles.diagramConnector}
              markerEnd="url(#workflow-arrow)"
            />
          ))}
        </svg>

        {mainPositions.map(({ state, x, y }, index) => {
          const isCurrent = state === currentState;
          const isSelected = selectedSet.has(state);
          const turnNumbers = turnNumbersByState.get(state) ?? [];
          return (
            <button
              key={state}
              type="button"
              data-testid={`workflow-stage-${state}`}
              className={`${styles.stageCard} ${isCurrent ? styles.stageCurrent : ''} ${isSelected ? styles.stageSelected : ''}`}
              style={{ left: `${(x / DIAGRAM_WIDTH) * 100}%`, top: `${(y / DIAGRAM_HEIGHT) * 100}%` }}
              onClick={() => onNodeSelect?.(state)}
            >
              <span className={styles.stageNumber}>{String(index + 1).padStart(2, '0')}</span>
              <span className={styles.stageName}>{stateLabel(state)}</span>
              {turnNumbers.length > 0 && (
                <span className={styles.stageTurnList}>
                  {turnNumbers.slice(0, 3).map((turnNumber) => (
                    <span key={turnNumber} className={styles.turnBadge}>
                      T{turnNumber}
                    </span>
                  ))}
                </span>
              )}
              <span className={styles.stageCode}>{state}</span>
            </button>
          );
        })}

        {exceptionPositions.map(({ state, x, y }) => (
          <button
            key={state}
            type="button"
            className={`${styles.exceptionChip} ${state === currentState ? styles.stageCurrent : ''}`}
            style={{ left: `${(x / DIAGRAM_WIDTH) * 100}%`, top: `${(y / DIAGRAM_HEIGHT) * 100}%` }}
            onClick={() => onNodeSelect?.(state)}
          >
            <span className={styles.stageName}>{stateLabel(state)}</span>
            <span className={styles.stageCode}>{state}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CurrentTurnInsight({
  message,
  turnNumber,
  logs,
}: Readonly<{
  message: DemoChatMessage | null;
  turnNumber: number | null;
  logs: DemoDecisionLogEntry[];
}>) {
  const latestLog = logs.at(-1) ?? null;

  return (
    <section className={styles.currentInsight} data-testid="current-turn-insight">
      <div className={styles.insightBlock}>
        <span className={styles.eyebrow}>Current Turn</span>
        {message ? (
          <>
            <div className={styles.insightTitle}>
              <span>{turnNumber ? `T${turnNumber}` : 'Turn'}</span>
              <span>{roleLabel(message.role)}</span>
              <span>{formatTime(message.timestamp)}</span>
            </div>
            <p className={styles.insightText}>{message.content}</p>
          </>
        ) : (
          <p className={styles.insightText}>선택된 상담 턴이 없습니다.</p>
        )}
      </div>

      <div className={styles.insightBlock}>
        <span className={styles.eyebrow}>Detected State</span>
        {latestLog ? (
          <>
            <div className={styles.statePair}>
              <span>{stateLabel(latestLog.stateFrom)}</span>
              <span>→</span>
              <strong>{stateLabel(latestLog.stateTo)}</strong>
            </div>
            <div className={styles.insightMeta}>
              <span>{latestLog.eventType}</span>
              <span>{latestLog.decision}</span>
              <span>{formatConfidence(latestLog.confidence)}</span>
            </div>
          </>
        ) : (
          <p className={styles.insightText}>아직 연결된 decision log가 없습니다.</p>
        )}
      </div>

      <div className={styles.insightBlock}>
        <span className={styles.eyebrow}>Reason</span>
        <p className={styles.insightText}>{latestLog?.reason ?? '근거가 없습니다.'}</p>
      </div>
    </section>
  );
}

export function SidePanel({
  workflow,
  execution,
  decisionLogs,
  selectedMessageId,
  activeMessageId,
  messages,
  domainPack,
  onNodeSelect,
}: SidePanelProps) {
  const workflowGraph = useMemo(() => adaptDemoWorkflow(workflow), [workflow]);
  const focusedMessageId = selectedMessageId ?? activeMessageId ?? null;
  const selectedNodeIds = useMemo(
    () =>
      focusedMessageId
        ? getNodeIdsByMessageId(focusedMessageId, decisionLogs, workflowGraph)
        : [],
    [focusedMessageId, decisionLogs, workflowGraph],
  );
  const focusedMessage = focusedMessageId
    ? messages.find((message) => message.id === focusedMessageId) ?? null
    : null;
  const focusedTurnNumber = focusedMessageId ? getTurnNumber(focusedMessageId, messages) : null;
  const focusedLogs = decisionLogs
    .filter((log) => log.messageId === focusedMessageId)
    .sort((a, b) => a.step - b.step);

  return (
    <div
      data-testid="side-panel"
      data-scrollable
      className={styles.sidePanel}
    >
      <div data-testid="side-panel-workflow-header">
        <ChatWorkflowHeader domainPack={domainPack} />
      </div>

      <div className={styles.workflowIntro}>
        <span className={styles.eyebrow}>Workflow</span>
        <h3>{workflow.name}</h3>
        <p>{workflow.description}</p>
      </div>

      <CurrentTurnInsight
        message={focusedMessage}
        turnNumber={focusedTurnNumber}
        logs={focusedLogs}
      />

      <div className={styles.graphSection} data-testid="graph-container">
        <WorkflowOverview
          workflow={workflow}
          selectedNodeIds={selectedNodeIds}
          currentState={execution?.currentState}
          messages={messages}
          decisionLogs={decisionLogs}
          onNodeSelect={onNodeSelect}
        />
      </div>

      <div className={styles.inspectorGrid}>
        <ExecutionDetailPanel execution={execution} />
        <DecisionLogDrawer entries={decisionLogs} selectedMessageId={focusedMessageId} />
      </div>
    </div>
  );
}
