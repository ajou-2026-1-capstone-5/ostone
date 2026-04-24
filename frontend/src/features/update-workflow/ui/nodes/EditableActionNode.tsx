import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./editableNodes.module.css";
import { useEditableNode } from "./useEditableNode";
import { useEditableField } from "./useEditableField";
import { NodeDeleteToolbar } from "./NodeDeleteToolbar";

export function EditableActionNode({ id, data, selected }: NodeProps) {
  const { deleteNode } = useEditableNode(id);
  const label = useEditableField(
    id,
    "label",
    typeof data?.label === "string" ? data.label : "",
  );
  const policyRef = useEditableField(
    id,
    "policyRef",
    typeof data?.policyRef === "string" ? data.policyRef : "",
  );

  return (
    <>
      <NodeDeleteToolbar selected={selected} onDelete={deleteNode} />
      <div className={styles.action}>
        <Handle type="target" position={Position.Left} />
        <input
          className={`nodrag nopan ${styles.labelInput}`}
          value={label.value}
          onChange={label.onChange}
          onFocus={label.onFocus}
          onBlur={label.onBlur}
          placeholder="노드 이름"
          aria-label="노드 이름"
        />
        <input
          className={`nodrag nopan ${styles.policyInput}`}
          value={policyRef.value}
          onChange={policyRef.onChange}
          onFocus={policyRef.onFocus}
          onBlur={policyRef.onBlur}
          placeholder="policyRef"
          aria-label="정책 참조 코드"
        />
        <Handle type="source" position={Position.Right} />
      </div>
    </>
  );
}
