import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./nodes.module.css";
import type { GraphNodeType } from "../../model/types";

export function ActionNode({ data }: NodeProps<{ label: string; type?: GraphNodeType; selected?: boolean; current?: boolean }>) {
  const isSelected = data?.selected === true;
  const isCurrent = data?.current === true;
  return (
    <div className={`${styles.action} ${isSelected ? styles.selected : ""} ${isCurrent ? styles.current : ""}`}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <span className={styles.label}>{data.label || "Action"}</span>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
