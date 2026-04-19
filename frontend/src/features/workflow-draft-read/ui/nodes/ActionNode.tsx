import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./nodes.module.css";

export function ActionNode({ data }: NodeProps) {
  const label = typeof data?.label === "string" ? data.label : "";
  return (
    <div className={styles.action}>
      <Handle type="target" position={Position.Left} />
      <span className={styles.label}>{label}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
