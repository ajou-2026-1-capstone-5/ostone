export interface WorkflowNode {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "start" | "end" | "task" | "decision" | "risk" | "human" | "error";
  pass?: number;
  n?: number;
  selected?: boolean;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  pct: number;
  cond?: string;
  isHot?: boolean;
  tone?: "signal" | "warn" | "danger";
}

export const DEFAULT_NODES: WorkflowNode[] = [
  {
    id: "start",
    label: "start",
    sub: "intent.refund_*",
    x: 4,
    y: 12,
    w: 10,
    h: 8,
    kind: "start",
  },
  {
    id: "collect",
    label: "collect_slots",
    sub: "3 required",
    x: 19,
    y: 11,
    w: 17,
    h: 10,
    kind: "task",
    pass: 0.96,
    n: 1389,
  },
  {
    id: "eligible",
    label: "eligible_check",
    sub: "POL-001 \u00b7 POL-014",
    x: 41,
    y: 10,
    w: 18,
    h: 12,
    kind: "decision",
    pass: 0.86,
    n: 1334,
    selected: true,
  },
  {
    id: "process",
    label: "process_refund",
    sub: "tx api \u00b7 idempotent",
    x: 64,
    y: 5,
    w: 17,
    h: 10,
    kind: "task",
    pass: 0.98,
    n: 1140,
  },
  {
    id: "risk",
    label: "risk_review",
    sub: "risk > 0.4",
    x: 41,
    y: 38,
    w: 18,
    h: 12,
    kind: "risk",
    pass: 0.71,
    n: 195,
  },
  {
    id: "manual",
    label: "manual_queue",
    sub: "sla 4m \u00b7 q-CS3",
    x: 64,
    y: 38,
    w: 17,
    h: 10,
    kind: "human",
    n: 168,
  },
  {
    id: "reject",
    label: "reject",
    sub: "not eligible",
    x: 64,
    y: 50,
    w: 17,
    h: 8,
    kind: "error",
    n: 81,
  },
  {
    id: "confirm",
    label: "confirm",
    sub: "send receipt",
    x: 86,
    y: 22,
    w: 13,
    h: 10,
    kind: "end",
    n: 1308,
  },
];

export const DEFAULT_EDGES: WorkflowEdge[] = [
  { from: "start", to: "collect", pct: 1.0 },
  { from: "collect", to: "eligible", pct: 0.96, cond: "slots \u2713" },
  {
    from: "eligible",
    to: "process",
    pct: 0.82,
    cond: "pass \u00b7 risk \u2264 0.4",
    isHot: true,
    tone: "signal",
  },
  { from: "eligible", to: "risk", pct: 0.14, cond: "risk > 0.4" },
  {
    from: "eligible",
    to: "reject",
    pct: 0.04,
    cond: "\u00d7 ineligible",
    tone: "danger",
  },
  { from: "risk", to: "manual", pct: 0.71, cond: "manual ok", tone: "warn" },
  { from: "risk", to: "reject", pct: 0.29, cond: "denied", tone: "danger" },
  { from: "process", to: "confirm", pct: 0.98 },
  { from: "manual", to: "confirm", pct: 0.86 },
];

function getNodeById(nodes: WorkflowNode[], id: string): WorkflowNode | undefined {
  return nodes.find((n) => n.id === id);
}

function getEdgePoints(
  src: WorkflowNode,
  tgt: WorkflowNode,
): { x1: number; y1: number; x2: number; y2: number; mx: number } {
  let x1: number;
  let y1: number;
  let x2: number;
  let y2: number;

  if (tgt.x > src.x + src.w) {
    x1 = src.x + src.w;
    y1 = src.y + src.h / 2;
    x2 = tgt.x;
    y2 = tgt.y + tgt.h / 2;
  } else if (tgt.y > src.y + src.h) {
    x1 = src.x + src.w / 2;
    y1 = src.y + src.h;
    x2 = tgt.x + tgt.w / 2;
    y2 = tgt.y;
  } else {
    x1 = src.x + src.w;
    y1 = src.y + src.h / 2;
    x2 = tgt.x;
    y2 = tgt.y + tgt.h / 2;
  }

  return { x1, y1, x2, y2, mx: (x1 + x2) / 2 };
}

function NodeShape({ node }: { node: WorkflowNode }) {
  const { x, y, w, h, kind } = node;

  switch (kind) {
    case "start":
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={4}
          ry={4}
          fill="var(--signal-bg)"
          stroke="var(--signal)"
          strokeWidth={0.3}
        />
      );
    case "end":
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={4}
          ry={4}
          fill="var(--paper-3)"
          stroke="var(--ink)"
          strokeWidth={0.3}
        />
      );
    case "task":
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="var(--paper-3)"
          stroke="var(--line)"
          strokeWidth={0.3}
        />
      );
    case "decision": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      return (
        <polygon
          points={`${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`}
          fill="var(--signal-bg)"
          stroke="var(--signal)"
          strokeWidth={0.3}
        />
      );
    }
    case "risk": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const hh = h / 2;
      const pts = `${cx},${y} ${x + w},${cy - hh / 2} ${x + w},${cy + hh / 2} ${cx},${y + h} ${x},${cy + hh / 2} ${x},${cy - hh / 2}`;
      return (
        <polygon
          points={pts}
          fill="var(--danger-bg)"
          stroke="var(--danger)"
          strokeWidth={0.3}
        />
      );
    }
    case "human": {
      const r = 1.5;
      const path = `M ${x},${y + r} L ${x + r},${y} L ${x + w - r},${y} Q ${x + w},${y} ${x + w},${y + r} L ${x + w},${y + h - r} Q ${x + w},${y + h} ${x + w - r},${y + h} L ${x + r},${y + h} L ${x},${y + h - r} Z`;
      return (
        <path
          d={path}
          fill="var(--warn-bg)"
          stroke="var(--warn)"
          strokeWidth={0.3}
        />
      );
    }
    case "error":
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="var(--danger-bg)"
          stroke="var(--danger)"
          strokeWidth={0.3}
        />
      );
    default:
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="var(--paper-3)"
          stroke="var(--line)"
          strokeWidth={0.3}
        />
      );
  }
}

function NodeLabels({ node }: { node: WorkflowNode }) {
  const { x, y, w, h, label, sub, pass, n } = node;
  const cx = x + w / 2;
  const labelY = y + h / 2 - 0.2;
  const subY = labelY + 1.3;
  const statY = y + h - 0.6;

  return (
    <>
      <text
        x={cx}
        y={labelY}
        textAnchor="middle"
        fontSize="1.2"
        fontFamily="var(--mono)"
        fill="var(--ink)"
        fontWeight={700}
      >
        {label}
      </text>
      <text
        x={cx}
        y={subY}
        textAnchor="middle"
        fontSize="0.8"
        fontFamily="var(--mono)"
        fill="var(--ink-3)"
        opacity={0.7}
      >
        {sub}
      </text>
      {(typeof pass === "number" || typeof n === "number") && (
        <text
          x={cx}
          y={statY}
          textAnchor="middle"
          fontSize="0.7"
          fontFamily="var(--mono)"
          fill="var(--ink-3)"
        >
          {typeof pass === "number" ? `${pass.toFixed(2)} ` : ""}
          {typeof n === "number" ? `n=${n.toLocaleString()}` : ""}
        </text>
      )}
    </>
  );
}

export function WorkflowCanvas({
  nodes,
  edges,
}: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}) {
  return (
    <svg
      viewBox="0 0 100 60"
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="4"
          markerHeight="3"
          refX="3.2"
          refY="1.5"
          orient="auto"
        >
          <polygon points="0 0, 4 1.5, 0 3" fill="var(--ink)" />
        </marker>
        <marker
          id="arrowheadHot"
          markerWidth="4"
          markerHeight="3"
          refX="3.2"
          refY="1.5"
          orient="auto"
        >
          <polygon points="0 0, 4 1.5, 0 3" fill="var(--signal)" />
        </marker>
        <marker
          id="arrowheadWarn"
          markerWidth="4"
          markerHeight="3"
          refX="3.2"
          refY="1.5"
          orient="auto"
        >
          <polygon points="0 0, 4 1.5, 0 3" fill="var(--warn)" />
        </marker>
        <marker
          id="arrowheadDanger"
          markerWidth="4"
          markerHeight="3"
          refX="3.2"
          refY="1.5"
          orient="auto"
        >
          <polygon points="0 0, 4 1.5, 0 3" fill="var(--danger)" />
        </marker>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {[
        { y: 12.5, label: "" },
        { y: 40.5, label: "" },
      ].map((lane, idx) => (
        <g key={`lane-${idx}`}>
          <path
            d={`M0,${lane.y} L100,${lane.y}`}
            stroke="var(--line-2)"
            strokeWidth={0.3}
            strokeDasharray="1 2"
          />
          <svg x={97} y={lane.y + 0.5} height={4} width={3}>
            <svg x={0} y={0} height={3} width={1}>
              <rect x={0} y={0} width={1} height={3} fill="var(--line-2)" opacity={0.5} />
            </svg>
          </svg>
        </g>
      ))}

      {edges.map((edge, i) => {
        const src = getNodeById(nodes, edge.from);
        const tgt = getNodeById(nodes, edge.to);
        if (!src || !tgt) return null;

        const { x1, y1, x2, y2, mx } = getEdgePoints(src, tgt);
        const strokeWidth = 0.25 + edge.pct * 0.7;
        const opacity = edge.isHot ? 1 : 0.55;

        let markerId = "arrowhead";
        let stroke = "var(--ink-3)";
        if (edge.tone === "signal" || edge.isHot) {
          markerId = "arrowheadHot";
          stroke = "var(--signal)";
        } else if (edge.tone === "warn") {
          markerId = "arrowheadWarn";
          stroke = "var(--warn)";
        } else if (edge.tone === "danger") {
          markerId = "arrowheadDanger";
          stroke = "var(--danger)";
        }

        const midY = (y1 + y2) / 2;

        return (
          <g key={`edge-${i}`}>
            <path
              d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              opacity={opacity}
              markerEnd={`url(#${markerId})`}
            />
            {edge.cond && (
              <g>
                <rect
                  x={mx - (edge.cond.length * 1.2 + 2)}
                  y={midY - 1.8}
                  width={edge.cond.length * 2.4 + 4}
                  height={3.6}
                  rx={1}
                  fill="var(--paper)"
                  stroke={edge.tone === "danger" ? "var(--danger)" : edge.tone === "warn" ? "var(--warn)" : "var(--line)"}
                  strokeWidth={0.3}
                />
                <text
                  x={mx}
                  y={midY + 0.5}
                  textAnchor="middle"
                  fontSize={2.2}
                  fontFamily="var(--mono)"
                  fill="var(--ink-2)"
                >
                  {edge.cond}
                </text>
              </g>
            )}
            <text
              x={mx}
              y={midY + 1.0}
              textAnchor="middle"
              fontSize="0.7"
              fontFamily="var(--mono)"
              fill={stroke}
              opacity={edge.isHot ? 1 : 0.8}
            >
              {Math.round(edge.pct * 100)}%
            </text>
          </g>
        );
      })}

      {nodes.map((node) => {
        if (!node.selected) return null;
        return (
          <rect
            key={`glow-${node.id}`}
            x={node.x - 1}
            y={node.y - 1}
            width={node.w + 2}
            height={node.h + 2}
            rx={5}
            ry={5}
            fill="transparent"
            stroke="var(--signal)"
            strokeWidth={0.4}
            filter="url(#glow)"
          />
        );
      })}

      {nodes.map((node) => (
        <g
          key={node.id}
          data-node-kind={node.kind}
          data-selected-halo={node.selected ? "" : undefined}
        >
          <NodeShape node={node} />
          {node.kind !== "start" && node.kind !== "end" && (
            <>
              <circle
                cx={node.x - 0.6}
                cy={node.y + node.h / 2}
                r={0.6}
                fill="var(--line-2)"
                stroke="var(--paper)"
                strokeWidth={0.2}
              />
              <circle
                cx={node.x + node.w + 0.6}
                cy={node.y + node.h / 2}
                r={0.6}
                fill="var(--line-2)"
                stroke="var(--paper)"
                strokeWidth={0.2}
              />
            </>
          )}
          <NodeLabels node={node} />
          {node.n != null && (
            <g>
              <rect
                x={node.x + node.w - 11.5}
                y={node.y + 1}
                width={11}
                height={3.5}
                rx={1}
                fill="var(--paper)"
                stroke="var(--line-2)"
                strokeWidth={0.3}
              />
              <text
                x={node.x + node.w - 0.5}
                y={node.y + 3.5}
                textAnchor="end"
                fontSize="1.6"
                fontFamily="var(--mono)"
                fill="var(--ink-3)"
              >
                {node.n >= 1000
                  ? `${(node.n / 1000).toFixed(1)}k`
                  : node.n}
              </text>
            </g>
          )}
          {node.pass != null && (
            <>
              <rect
                x={node.x + 1.2}
                y={node.y + node.h - 2.8}
                width={node.w - 2.4}
                height={0.7}
                rx={0.3}
                fill="var(--paper-2)"
              />
              <rect
                x={node.x + 1.2}
                y={node.y + node.h - 2.8}
                width={(node.w - 2.4) * node.pass}
                height={0.7}
                rx={0.3}
                fill="var(--signal)"
                opacity={0.7}
              />
            </>
          )}
        </g>
      ))}
    </svg>
  );
}
