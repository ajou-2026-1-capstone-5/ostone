import { type NodeProps } from "@xyflow/react";
import { readBadges, readString, renderNodeIcon } from "@/entities/workflow/lib/nodeUtils";
import styles from "./editableNodes.module.css";
import { useEditableNode } from "./useEditableNode";
import { useEditableField } from "./useEditableField";
import { NodeDeleteToolbar } from "./NodeDeleteToolbar";
import { EditableNodeShell } from "./EditableNodeShell";

/** Width-of-content heuristic for the policyRef chip-input: clamp to a
    sensible range so the chip doesn't shrink to a thin sliver when empty
    nor stretch beyond the card width when filled with a long code. */
function chipInputSize(value: string): number {
  return Math.max(8, Math.min(value.length + 2, 24));
}

export function EditableActionNode({ id, data, selected }: NodeProps) {
  const { deleteNode } = useEditableNode(id);
  const label = useEditableField(id, "label", typeof data?.label === "string" ? data.label : "");
  const policyRef = useEditableField(
    id,
    "policyRef",
    typeof data?.policyRef === "string" ? data.policyRef : "",
  );
  const description = readString(data, "description");
  const badges = readBadges(data);
  const iconHint = readString(data, "iconHint");

  return (
    <>
      <NodeDeleteToolbar selected={selected} onDelete={deleteNode} />
      <EditableNodeShell
        nodeId={id}
        kindClassName={styles.action}
        icon={renderNodeIcon("ACTION", iconHint)}
        labelInput={
          <input
            className={`nodrag nopan ${styles.labelInput}`}
            value={label.value}
            onChange={label.onChange}
            onFocus={label.onFocus}
            onBlur={label.onBlur}
            placeholder="노드 이름"
            aria-label="노드 이름"
          />
        }
        description={description}
        badges={badges}
        policyRefSlot={
          <input
            className={`nodrag nopan ${styles.policyChipInput}`}
            value={policyRef.value}
            onChange={policyRef.onChange}
            onFocus={policyRef.onFocus}
            onBlur={policyRef.onBlur}
            size={chipInputSize(policyRef.value)}
            placeholder="policyRef"
            aria-label="정책 참조 코드"
          />
        }
        containerTestId="editable-action-node"
      />
    </>
  );
}
