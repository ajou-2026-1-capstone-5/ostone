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
  disabledTypes?: GraphNodeType[];
}

export function AddNodeToolbar({ onAddNode, disabledTypes = [] }: AddNodeToolbarProps) {
  return (
    <div className={styles.toolbar}>
      {NODE_TYPES.map((type) => {
        const isDisabled = disabledTypes.includes(type);
        return (
          <button
            key={type}
            type="button"
            className={styles.addNodeBtn}
            onClick={() => onAddNode(type)}
            disabled={isDisabled}
          >
            + {type}
          </button>
        );
      })}
    </div>
  );
}
