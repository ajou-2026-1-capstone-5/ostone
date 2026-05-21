import { type NodeProps } from "@xyflow/react";
import { readBadges, readString, renderNodeIcon } from "@/entities/workflow/lib/nodeUtils";
import styles from "./editableNodes.module.css";
import { useEditableField } from "./useEditableField";
import { EditableNodeShell } from "./EditableNodeShell";

export function EditableStartNode({ id, data }: NodeProps) {
  const label = useEditableField(id, "label", typeof data?.label === "string" ? data.label : "");
  const description = readString(data, "description");
  const badges = readBadges(data);
  const iconHint = readString(data, "iconHint");

  return (
    <EditableNodeShell
      nodeId={id}
      kindClassName={styles.start}
      icon={renderNodeIcon("START", iconHint)}
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
      targetSides={[]}
      containerTestId="editable-start-node"
    />
  );
}
