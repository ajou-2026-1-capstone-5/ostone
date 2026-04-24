import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./editableNodes.module.css";
import { useEditableNode } from "./useEditableNode";
import { NodeDeleteToolbar } from "./NodeDeleteToolbar";

export function EditableActionNode({ id, data, selected }: NodeProps) {
  const { updateField, deleteNode } = useEditableNode(id);
  const [label, setLabel] = useState(typeof data?.label === "string" ? data.label : "");
  const [policyRef, setPolicyRef] = useState(
    typeof data?.policyRef === "string" ? data.policyRef : "",
  );

  return (
    <>
      <NodeDeleteToolbar selected={selected} onDelete={deleteNode} />
      <div className={styles.action}>
        <Handle type="target" position={Position.Left} />
        <input
          className={styles.labelInput}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => updateField("label", label)}
          placeholder="노드 이름"
          aria-label="노드 이름"
        />
        <input
          className={styles.policyInput}
          value={policyRef}
          onChange={(e) => setPolicyRef(e.target.value)}
          onBlur={() => updateField("policyRef", policyRef)}
          placeholder="policyRef"
          aria-label="정책 참조 코드"
        />
        <Handle type="source" position={Position.Right} />
      </div>
    </>
  );
}
