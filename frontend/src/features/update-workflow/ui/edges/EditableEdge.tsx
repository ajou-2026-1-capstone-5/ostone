import { useState, useEffect, useRef } from "react";
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
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalLabel(typeof label === "string" ? label : "");
    }
  }, [label]);

  const commitLabel = () => {
    focusedRef.current = false;
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
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={commitLabel}
          placeholder="전이 조건"
          aria-label="엣지 레이블"
          title="이 조건을 만족할 때 다음 노드로 전환합니다. 분기에서 어떤 흐름으로 이어질지 결정하는 표시값입니다."
        />
      </EdgeLabelRenderer>
    </>
  );
}
