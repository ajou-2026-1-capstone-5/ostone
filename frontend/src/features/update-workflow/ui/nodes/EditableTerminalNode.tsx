import { type NodeProps } from "@xyflow/react";
import { renderNodeIcon } from "@/entities/workflow/lib/nodeUtils";
import { useConnectedSides } from "@/entities/workflow/lib/useConnectedSides";
import styles from "./editableNodes.module.css";
import { useEditableNode } from "./useEditableNode";
import { useEditableField } from "./useEditableField";
import { NodeDeleteToolbar } from "./NodeDeleteToolbar";
import { EditableHandles } from "./_EditableHandles";

export function EditableTerminalNode({ id, data, selected }: NodeProps) {
  const { deleteNode } = useEditableNode(id);
  const label = useEditableField(id, "label", typeof data?.label === "string" ? data.label : "");
  const { targets: connectedTargets } = useConnectedSides(id);

  return (
    <>
      <NodeDeleteToolbar selected={selected} onDelete={deleteNode} />
      <div className={styles.terminal} data-testid="editable-terminal-node">
        <EditableHandles sources={[]} connectedTargets={connectedTargets} />
        {renderNodeIcon("TERMINAL", undefined, { size: 18, className: styles.terminalIcon })}
        <input
          className={`nodrag nopan ${styles.terminalInput}`}
          value={label.value}
          onChange={label.onChange}
          onFocus={label.onFocus}
          onBlur={label.onBlur}
          placeholder="종료"
          aria-label="노드 이름"
        />
      </div>
    </>
  );
}
