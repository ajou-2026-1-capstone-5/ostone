import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";

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
          className="nodrag nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
            background: "var(--bg-color, #fff)",
            border: "1px dashed var(--text-primary, #000)",
            borderRadius: "4px",
            padding: "2px 6px",
            fontSize: "11px",
            fontFamily: "inherit",
            color: "var(--text-primary, #000)",
            textAlign: "center",
            width: "80px",
            outline: "none",
          }}
          value={labelValue}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="label"
          aria-label="엣지 레이블"
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.outline = "dashed 2px var(--text-primary, #000)";
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.outline = "none";
          }}
        />
      </EdgeLabelRenderer>
    </>
  );
}
