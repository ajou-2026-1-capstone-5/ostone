import { useState, useEffect } from "react";
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

  const [localLabel, setLocalLabel] = useState(typeof label === "string" ? label : "");

  useEffect(() => {
    setLocalLabel(label ?? "");
  }, [label]);

  const commitLabel = () => {
    setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, label: localLabel } : e)));
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
          value={localLabel}
          onChange={(e) => setLocalLabel(e.target.value)}
          onBlur={commitLabel}
          placeholder="label"
          aria-label="엣지 레이블"
        />
      </EdgeLabelRenderer>
    </>
  );
}
