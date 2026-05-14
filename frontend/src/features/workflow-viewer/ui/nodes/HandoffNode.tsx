import { Handle, Position, type NodeProps } from "@xyflow/react";
import theme from "@/shared/styles/workflow-node-theme.module.css";
import { DEFAULT_NODE_STATUS, type GraphNodeStatus } from "@/entities/workflow";

const STATUS_MAP: Record<GraphNodeStatus, string> = {
  IDLE: theme.statusIdle,
  ACTIVE: theme.statusActive,
  COMPLETED: theme.statusCompleted,
  FAILED: theme.statusFailed,
};

export function HandoffNode({ data }: NodeProps) {
  const label = typeof data?.label === "string" ? data.label : "";
  const status: GraphNodeStatus =
    (data?.status as GraphNodeStatus | undefined) ?? DEFAULT_NODE_STATUS;
  const statusClass = STATUS_MAP[status] ?? theme.statusIdle;

  return (
    <div className={`${theme.handoff} ${statusClass}`}>
      <Handle type="target" position={Position.Left} />
      <span>{label}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
