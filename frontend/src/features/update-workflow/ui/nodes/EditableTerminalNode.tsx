import { type NodeProps, useStore } from "@xyflow/react";
import { renderNodeIcon } from "@/entities/workflow/lib/nodeUtils";
import type { HandleSide } from "@/entities/workflow";
import styles from "./editableNodes.module.css";
import { useEditableNode } from "./useEditableNode";
import { useEditableField } from "./useEditableField";
import { NodeDeleteToolbar } from "./NodeDeleteToolbar";
import { EditableHandles } from "./_EditableHandles";

const VALID_SIDES = new Set<HandleSide>(["left", "right", "top", "bottom"]);

export function EditableTerminalNode({ id, data, selected }: NodeProps) {
  const { deleteNode } = useEditableNode(id);
  const label = useEditableField(id, "label", typeof data?.label === "string" ? data.label : "");

  const connectedTargets = useStore(
    (s) => {
      const sides = new Set<HandleSide>();
      for (const edge of s.edges) {
        if (
          edge.target === id &&
          edge.targetHandle &&
          VALID_SIDES.has(edge.targetHandle as HandleSide)
        ) {
          sides.add(edge.targetHandle as HandleSide);
        }
      }
      return Array.from(sides);
    },
    (a, b) => a.length === b.length && a.every((s) => b.includes(s)),
  );

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
