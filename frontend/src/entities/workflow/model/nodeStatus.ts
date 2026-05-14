import type { GraphNodeType } from "./types";

export type { GraphNodeType } from "./types";

export const NODE_TYPES: GraphNodeType[] = [
  "START",
  "ACTION",
  "DECISION",
  "ANSWER",
  "HANDOFF",
  "TERMINAL",
];

export type GraphNodeStatus =
  | "IDLE"
  | "ACTIVE"
  | "COMPLETED"
  | "FAILED";

export const NODE_STATUSES: GraphNodeStatus[] = [
  "IDLE",
  "ACTIVE",
  "COMPLETED",
  "FAILED",
];

export interface GraphNodeStyleConfig {
  className: string;
  label: string;
}

export const NODE_STATUS_STYLE_MAP: Record<GraphNodeStatus, GraphNodeStyleConfig> = {
  IDLE: { className: "statusIdle", label: "대기" },
  ACTIVE: { className: "statusActive", label: "실행 중" },
  COMPLETED: { className: "statusCompleted", label: "완료" },
  FAILED: { className: "statusFailed", label: "실패" },
};

export const DEFAULT_NODE_STATUS: GraphNodeStatus = "IDLE";
