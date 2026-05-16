import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./nodes.module.css";

export function TerminalNode({ data }: NodeProps) {
  const label = typeof data?.label === "string" ? data.label : "";
  return (
    <div className={styles.terminal}>
      <Handle type="target" position={Position.Left} />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
