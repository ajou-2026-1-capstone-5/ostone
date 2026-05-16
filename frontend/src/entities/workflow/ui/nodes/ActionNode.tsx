import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./nodes.module.css";

export function ActionNode({ data }: NodeProps) {
  const d = data as { label?: string; selected?: boolean; current?: boolean };
  const isSelected = d?.selected === true;
  const isCurrent = d?.current === true;
  return (
    <div className={`${styles.action} ${isSelected ? styles.selected : ""} ${isCurrent ? styles.current : ""}`}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <span className={styles.label}>{d.label || "Action"}</span>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
