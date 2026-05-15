import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./nodes.module.css";

export function ActionNode({ data }: NodeProps) {
  const label = typeof data?.label === "string" ? data.label : "";
  const isSelected = data?.selected === true;
  return (
    <div className={`${styles.action} ${isSelected ? styles.selected : ""}`}>
      <Handle type="target" position={Position.Left} />
      <span className={styles.label}>{label}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
