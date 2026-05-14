import { Handle, Position, type NodeProps } from "@xyflow/react";
import theme from "@/shared/styles/workflow-node-theme.module.css";
import { DEFAULT_NODE_STATUS, type GraphNodeStatus } from "@/entities/workflow";
import { STATUS_MAP } from "../nodeStyles";

export function ActionNode({ data }: NodeProps) {
  const label = typeof data?.label === "string" ? data.label : "";
  const status: GraphNodeStatus =
    (data?.status as GraphNodeStatus | undefined) ?? DEFAULT_NODE_STATUS;
  const policyRef =
    typeof data?.policyRef === "string" ? data.policyRef : undefined;

  return (
    <div className={`${theme.action} ${STATUS_MAP[status] ?? theme.statusIdle}`}>
      <Handle type="target" position={Position.Left} />
      <div>{label}</div>
      {policyRef && <div>{policyRef}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
