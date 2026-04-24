import type { GraphNodeType } from "@/entities/workflow";
import styles from "./addNodeToolbar.module.css";

const NODE_TYPES: GraphNodeType[] = [
  "START",
  "ACTION",
  "DECISION",
  "ANSWER",
  "HANDOFF",
  "TERMINAL",
];

interface AddNodeToolbarProps {
  onAddNode: (type: GraphNodeType) => void;
}

export function AddNodeToolbar({ onAddNode }: AddNodeToolbarProps) {
  return (
    <div className={styles.toolbar}>
      {NODE_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className={styles.addNodeBtn}
          onClick={() => onAddNode(type)}
        >
          + {type}
        </button>
      ))}
    </div>
  );
}
