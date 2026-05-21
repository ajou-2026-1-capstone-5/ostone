import { Handle, type HandleType } from "@xyflow/react";
import type { HandleSide } from "@/entities/workflow";
import { SIDE_TO_POSITION } from "@/entities/workflow/lib/handleUtils";
import styles from "./editableNodes.module.css";

const ALL_SIDES: readonly HandleSide[] = ["left", "right", "top", "bottom"];

interface EditableHandlesProps {
  sources?: readonly HandleSide[];
  targets?: readonly HandleSide[];
  /**
   * Sides currently used by at least one outgoing edge.
   * Visible by default; other source sides only appear on hover.
   */
  connectedSources?: readonly HandleSide[];
  /**
   * Sides currently used by at least one incoming edge.
   * Visible by default; other target sides only appear on hover.
   */
  connectedTargets?: readonly HandleSide[];
}

function handleClassName(side: HandleSide, connected: readonly HandleSide[]): string {
  return connected.includes(side) ? `${styles.handle} ${styles.handleConnected}` : styles.handle;
}

export function EditableHandles({
  sources = ALL_SIDES,
  targets = ALL_SIDES,
  connectedSources = [],
  connectedTargets = [],
}: EditableHandlesProps) {
  return (
    <>
      {targets.map((side) => (
        <Handle
          key={`target-${side}`}
          id={side}
          type={"target" as HandleType}
          position={SIDE_TO_POSITION[side]}
          className={handleClassName(side, connectedTargets)}
          data-testid={`editable-handle-target-${side}`}
        />
      ))}
      {sources.map((side) => (
        <Handle
          key={`source-${side}`}
          id={side}
          type={"source" as HandleType}
          position={SIDE_TO_POSITION[side]}
          className={handleClassName(side, connectedSources)}
          data-testid={`editable-handle-source-${side}`}
        />
      ))}
    </>
  );
}
