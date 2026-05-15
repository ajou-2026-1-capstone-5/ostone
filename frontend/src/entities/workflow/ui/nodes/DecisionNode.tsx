import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./nodes.module.css";

export function DecisionNode({ data }: NodeProps) {
  const label = typeof data?.label === "string" ? data.label : "";
  return (
    <div className={styles.decision}>
      <Handle type="target" position={Position.Left} />
      <span className={styles.decisionLabel}>{label}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
