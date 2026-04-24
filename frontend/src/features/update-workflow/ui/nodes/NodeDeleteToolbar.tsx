import { NodeToolbar, Position } from "@xyflow/react";
import styles from "./editableNodes.module.css";

interface NodeDeleteToolbarProps {
  selected: boolean | undefined;
  onDelete: () => void;
}

export function NodeDeleteToolbar({ selected, onDelete }: NodeDeleteToolbarProps) {
  return (
    <NodeToolbar isVisible={selected} position={Position.Top}>
      <button className={styles.deleteBtn} onClick={onDelete} type="button">
        삭제
      </button>
    </NodeToolbar>
  );
}
