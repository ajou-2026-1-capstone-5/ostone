import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";

export function useEditableNode(id: string) {
  const { updateNodeData, deleteElements } = useReactFlow();

  const updateField = useCallback(
    (field: string, value: unknown) => {
      updateNodeData(id, { [field]: value });
    },
    [id, updateNodeData],
  );

  const deleteNode = useCallback(() => {
    deleteElements({ nodes: [{ id }] });
  }, [id, deleteElements]);

  return { updateField, deleteNode };
}
