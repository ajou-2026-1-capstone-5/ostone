import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./nodes.module.css";

export function HandoffNode({ data }: NodeProps) {
  const label = typeof data?.label === "string" ? data.label : "";
  return (
    <div className={styles.handoff}>
      <Handle type="target" position={Position.Left} />
      {label}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
