import { type NodeProps } from "@xyflow/react";
import { readBadges, readString, renderNodeIcon } from "@/entities/workflow/lib/nodeUtils";
import styles from "./editableNodes.module.css";
import { useEditableNode } from "./useEditableNode";
import { useEditableField } from "./useEditableField";
import { NodeDeleteToolbar } from "./NodeDeleteToolbar";
import { EditableNodeShell } from "./EditableNodeShell";

export function EditableDecisionNode({ id, data, selected }: NodeProps) {
  const { deleteNode } = useEditableNode(id);
  const label = useEditableField(id, "label", typeof data?.label === "string" ? data.label : "");
  const description = readString(data, "description");
  const badges = readBadges(data);
  const iconHint = readString(data, "iconHint");

  return (
    <>
      <NodeDeleteToolbar selected={selected} onDelete={deleteNode} />
      <EditableNodeShell
        nodeId={id}
        kindClassName={styles.decision}
        icon={renderNodeIcon("DECISION", iconHint)}
        labelInput={
          <input
            className={`nodrag nopan ${styles.labelInput}`}
            value={label.value}
            onChange={label.onChange}
            onFocus={label.onFocus}
            onBlur={label.onBlur}
            placeholder="분기 조건"
            aria-label="노드 이름"
          />
        }
        description={description}
        badges={badges}
        containerTestId="editable-decision-node"
      />
    </>
  );
}
