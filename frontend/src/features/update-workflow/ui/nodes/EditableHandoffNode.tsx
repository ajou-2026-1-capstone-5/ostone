import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./editableNodes.module.css";
import { useEditableNode } from "./useEditableNode";
import { NodeDeleteToolbar } from "./NodeDeleteToolbar";

export function EditableHandoffNode({ id, data, selected }: NodeProps) {
  const { updateField, deleteNode } = useEditableNode(id);
  const [label, setLabel] = useState(typeof data?.label === "string" ? data.label : "");

  return (
    <>
      <NodeDeleteToolbar selected={selected} onDelete={deleteNode} />
      <div className={styles.handoff}>
        <Handle type="target" position={Position.Left} />
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
    </>
  );
}
