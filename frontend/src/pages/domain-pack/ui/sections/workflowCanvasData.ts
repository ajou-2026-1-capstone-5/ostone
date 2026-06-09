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
    sub: "POL-001 · POL-014",
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
    sub: "tx api · idempotent",
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
    sub: "sla 4m · q-CS3",
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
  { from: "collect", to: "eligible", pct: 0.96, cond: "slots ✓" },
  {
    from: "eligible",
    to: "process",
    pct: 0.82,
    cond: "pass · risk ≤ 0.4",
    isHot: true,
    tone: "signal",
  },
  { from: "eligible", to: "risk", pct: 0.14, cond: "risk > 0.4" },
  {
    from: "eligible",
    to: "reject",
    pct: 0.04,
    cond: "× ineligible",
    tone: "danger",
  },
  { from: "risk", to: "manual", pct: 0.71, cond: "manual ok", tone: "warn" },
  { from: "risk", to: "reject", pct: 0.29, cond: "denied", tone: "danger" },
  { from: "process", to: "confirm", pct: 0.98 },
  { from: "manual", to: "confirm", pct: 0.86 },
];
