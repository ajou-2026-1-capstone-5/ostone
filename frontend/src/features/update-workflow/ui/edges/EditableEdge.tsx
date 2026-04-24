import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import styles from "./editableEdge.module.css";

export function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  markerEnd,
  style,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const labelValue = typeof label === "string" ? label : "";

  const handleLabelChange = (value: string) => {
    setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, label: value } : e)));
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <input
          className={`nodrag nopan ${styles.edgeLabelInput}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          value={labelValue}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="label"
          aria-label="엣지 레이블"
        />
      </EdgeLabelRenderer>
    </>
  );
}
