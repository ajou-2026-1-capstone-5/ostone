import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./editableNodes.module.css";
import { useEditableNode } from "./useEditableNode";

export function EditableStartNode({ id, data }: NodeProps) {
  const { updateField } = useEditableNode(id);
  const [label, setLabel] = useState(typeof data?.label === "string" ? data.label : "");

  return (
    <div className={styles.start}>
      <input
        className={styles.labelInput}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => updateField("label", label)}
        placeholder="노드 이름"
        aria-label="노드 이름"
      />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
