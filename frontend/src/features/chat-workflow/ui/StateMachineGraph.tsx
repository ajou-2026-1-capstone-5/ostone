import type { DemoWorkflowTransition, DemoDecisionLogEntry } from '../model/chatWorkflow.types';

interface StateMachineGraphProps {
  states: string[];
  transitions: DemoWorkflowTransition[];
  decisionLogs: DemoDecisionLogEntry[];
  selectedMessageId: string | null;
  currentState: string;
}

const NODE_W = 140;
const NODE_H = 48;
const NODE_GAP = 60;
const START_X = 20;
const NODE_Y = 40;
const CENTER_Y = NODE_Y + NODE_H / 2;
const SVG_H = 120;

function stateX(index: number): number {
  return START_X + index * (NODE_W + NODE_GAP);
}

function svgWidth(stateCount: number): number {
  if (stateCount === 0) return 0;
  return START_X + stateCount * (NODE_W + NODE_GAP) - NODE_GAP + 20;
}

export function StateMachineGraph({
  states,
  transitions,
  decisionLogs,
  selectedMessageId,
  currentState,
}: StateMachineGraphProps) {
  const highlightedStates = new Set<string>();
  const matchedTransitionKeys = new Set<string>();

  if (selectedMessageId) {
    const matchedLogs = decisionLogs.filter((log) => log.messageId === selectedMessageId);
    for (const log of matchedLogs) {
      highlightedStates.add(log.stateFrom);
      highlightedStates.add(log.stateTo);
      matchedTransitionKeys.add(`${log.stateFrom}\u2192${log.stateTo}`);
    }
  }

  const hasFilter = selectedMessageId !== null;

  return (
    <div data-testid="graph-container" className="w-full overflow-x-auto">
      <svg width={svgWidth(states.length)} height={SVG_H} className="block">
        <defs>
          <marker id="arr" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
          </marker>
          <marker id="arr-blue" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>
        </defs>

        {transitions.map((t, i) => {
          const fromIdx = states.indexOf(t.from);
          const toIdx = states.indexOf(t.to);
          if (fromIdx === -1 || toIdx === -1) return null;

          const x1 = stateX(fromIdx) + NODE_W;
          const y1 = CENTER_Y;
          const x2 = stateX(toIdx);
          const y2 = CENTER_Y;

          const inPath = hasFilter && matchedTransitionKeys.has(`${t.from}\u2192${t.to}`);
          const dimmed = hasFilter && !inPath;
          const strokeColor = inPath ? "#3b82f6" : "#9ca3af";
          const markerEnd = inPath ? "url(#arr-blue)" : "url(#arr)";

          return (
            <g key={i} data-testid="transition-arrow" opacity={dimmed ? 0.35 : 1}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={strokeColor}
                strokeWidth={inPath ? 2.5 : 2}
                markerEnd={markerEnd}
              />
              {t.on && (
                <text
                  x={(x1 + x2) / 2}
                  y={y1 - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill={inPath ? "#3b82f6" : "#6b7280"}
                  className="select-none"
                >
                  {t.on}
                </text>
              )}
            </g>
          );
        })}

        {states.map((state, i) => {
          const x = stateX(i);
          const y = NODE_Y;

          const isCurrent = state === currentState;
          const inPath = highlightedStates.has(state);
          const dimmed = hasFilter && !inPath && !isCurrent;

          let strokeColor = "#d1d5db";
          let textColor = "#374151";
          let strokeW = 2;
          let fillColor = "#ffffff";

          if (isCurrent) {
            strokeColor = "#22c55e";
            textColor = "#22c55e";
            strokeW = 3;
            fillColor = "#f0fdf4";
          } else if (inPath) {
            strokeColor = "#3b82f6";
            textColor = "#3b82f6";
            fillColor = "#eff6ff";
          }

          return (
            <g
              key={state}
              data-testid={`state-node-${state}`}
              data-current={isCurrent ? "true" : "false"}
              data-highlighted={inPath || isCurrent ? "true" : "false"}
              data-dimmed={dimmed ? "true" : "false"}
              opacity={dimmed ? 0.4 : 1}
            >
              <rect
                x={x} y={y}
                width={NODE_W} height={NODE_H}
                rx={8} ry={8}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeW}
              />
              <text
                x={x + NODE_W / 2}
                y={y + NODE_H / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="13"
                fontWeight={isCurrent ? "700" : "500"}
                fill={textColor}
                className="select-none"
              >
                {state}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
