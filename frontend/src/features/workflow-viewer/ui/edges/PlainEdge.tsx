import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import theme from "@/shared/styles/workflow-node-theme.module.css";
import { classifyLabelTone } from "./edgeLabelTone";

export function PlainEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  label,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  const tone = classifyLabelTone(label);
  const labelClass =
    tone === "yes"
      ? `${theme.edgeLabel} ${theme.edgeLabelYes}`
      : tone === "no"
        ? `${theme.edgeLabel} ${theme.edgeLabelNo}`
        : theme.edgeLabel;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className={`nodrag nopan ${labelClass}`}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
