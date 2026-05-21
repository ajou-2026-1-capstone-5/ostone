import { type ReactNode } from "react";
import type { HandleSide } from "@/entities/workflow";
import { useConnectedSides } from "@/entities/workflow/lib/useConnectedSides";
import styles from "./editableNodes.module.css";
import { EditableHandles } from "./_EditableHandles";

interface EditableNodeShellProps {
  nodeId: string;
  kindClassName: string;
  icon: ReactNode;
  /** Editable label input element (controlled by parent via useEditableField). */
  labelInput: ReactNode;
  description?: string;
  badges?: readonly string[];
  /**
   * Optional element rendered as the FIRST item inside the footer chip row.
   * The caller is responsible for styling it to match the viewer's chip
   * (typically the policyRef chip-input). Rendering it inside the footer
   * keeps the visual hierarchy aligned with the viewer.
   */
  policyRefSlot?: ReactNode;
  sourceSides?: readonly HandleSide[];
  targetSides?: readonly HandleSide[];
  containerTestId?: string;
}

export function EditableNodeShell({
  nodeId,
  kindClassName,
  icon,
  labelInput,
  description,
  badges,
  policyRefSlot,
  sourceSides,
  targetSides,
  containerTestId,
}: EditableNodeShellProps) {
  const connected = useConnectedSides(nodeId);
  const hasFooter = Boolean(policyRefSlot) || (badges && badges.length > 0);
  return (
    <div className={kindClassName} data-testid={containerTestId}>
      <EditableHandles
        sources={sourceSides}
        targets={targetSides}
        connectedSources={connected.sources}
        connectedTargets={connected.targets}
      />
      <div className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          {icon}
        </span>
        {labelInput}
      </div>
      {description && (
        <div className={styles.body}>
          <p className={styles.description}>{description}</p>
        </div>
      )}
      {hasFooter && (
        <div className={styles.footer}>
          {policyRefSlot}
          {badges?.map((badge, i) => (
            <span key={`${badge}-${i}`} className={styles.chip}>
              {badge}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
