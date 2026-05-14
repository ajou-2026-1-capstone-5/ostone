import { Handle, Position, type NodeProps } from "@xyflow/react";
import theme from "@/shared/styles/workflow-node-theme.module.css";
import { DEFAULT_NODE_STATUS, type GraphNodeStatus } from "@/entities/workflow";
import { STATUS_MAP } from "../nodeStyles";

export function TerminalNode({ data }: NodeProps) {
  const label = typeof data?.label === "string" ? data.label : "";
  const status: GraphNodeStatus =
    (data?.status as GraphNodeStatus | undefined) ?? DEFAULT_NODE_STATUS;
  const statusClass = STATUS_MAP[status] ?? theme.statusIdle;

  return (
    <div className={`${theme.terminal} ${statusClass}`}>
      <Handle type="target" position={Position.Left} />
      <span>{label}</span>
    </div>
  );
}
