import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./nodes.module.css";

export function StartNode({ data }: NodeProps) {
  const label = typeof data?.label === "string" ? data.label : "";
  return (
    <div className={styles.start}>
      <span className={styles.label}>{label}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
