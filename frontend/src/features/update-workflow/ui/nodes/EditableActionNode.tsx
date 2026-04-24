import { Handle, Position, NodeToolbar, useReactFlow, type NodeProps } from "@xyflow/react";
import styles from "./editableNodes.module.css";

export function EditableActionNode({ id, data, selected }: NodeProps) {
  const { setNodes, deleteElements } = useReactFlow();
  const label = typeof data?.label === "string" ? data.label : "";
  const policyRef = typeof data?.policyRef === "string" ? data.policyRef : "";

  const handleLabelChange = (value: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: value } } : n)),
    );
  };

  const handlePolicyRefChange = (value: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, policyRef: value } } : n)),
    );
  };

  const handleDelete = () => {
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <button className={styles.deleteBtn} onClick={handleDelete} type="button">
          삭제
        </button>
      </NodeToolbar>
      <div className={styles.action}>
        <Handle type="target" position={Position.Left} />
        <input
          className={styles.labelInput}
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="label"
          aria-label="노드 이름"
        />
        <input
          className={styles.policyInput}
          value={policyRef}
          onChange={(e) => handlePolicyRefChange(e.target.value)}
          placeholder="policyRef"
          aria-label="policyRef"
        />
        <Handle type="source" position={Position.Right} />
      </div>
    </>
  );
}
