import { useReactFlow } from "@xyflow/react";

export function useEditableNode(id: string) {
  const { updateNodeData, deleteElements } = useReactFlow();

  function updateField(field: string, value: unknown) {
    updateNodeData(id, { [field]: value });
  }

  function deleteNode() {
    deleteElements({ nodes: [{ id }] });
  }

  return { updateField, deleteNode };
}
