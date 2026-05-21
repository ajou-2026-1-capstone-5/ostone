import type { ReactNode } from "react";
import { Handle, type HandleType } from "@xyflow/react";
import type { HandleSide } from "@/entities/workflow";
import { SIDE_TO_POSITION } from "@/entities/workflow/lib/handleUtils";
import theme from "@/shared/styles/workflow-node-theme.module.css";

interface NodeCardShellProps {
  kindClassName: string;
  /**
   * Optional runtime status class. Definition-view callers should leave this
   * empty so the runtime status badge (✓ 완료 / ! 실패) doesn't leak into the
   * editor / read-only canvas.
   */
  statusClassName?: string;
  icon: ReactNode;
  title: string;
  description?: string;
  badges?: readonly string[];
  policyRef?: string;
  /** Sides connected as outgoing edges. Only these source handles render. */
  sourceHandles?: readonly HandleSide[];
  /** Sides connected as incoming edges. Only these target handles render. */
  targetHandles?: readonly HandleSide[];
  labelTestId?: string;
  containerTestId?: string;
}

function renderHandles(sides: readonly HandleSide[], type: HandleType): ReactNode {
  return sides.map((side) => (
    <Handle
      key={`${type}-${side}`}
      id={side}
      type={type}
      position={SIDE_TO_POSITION[side]}
      className={theme.handle}
      isConnectable={false}
    />
  ));
}

export function NodeCardShell({
  kindClassName,
  statusClassName,
  icon,
  title,
  description,
  badges,
  policyRef,
  sourceHandles = [],
  targetHandles = [],
  labelTestId,
  containerTestId,
}: NodeCardShellProps) {
  const hasFooter = Boolean(policyRef) || (badges && badges.length > 0);
  const className = statusClassName ? `${kindClassName} ${statusClassName}` : kindClassName;
  return (
    <div className={className} data-testid={containerTestId}>
      {renderHandles(targetHandles, "target")}
      <div className={theme.header}>
        <span className={theme.headerIcon} aria-hidden="true">
          {icon}
        </span>
        <span className={theme.headerTitle} data-testid={labelTestId}>
          {title}
        </span>
      </div>
      <div className={theme.body}>
        {description && <p className={theme.description}>{description}</p>}
      </div>
      {hasFooter && (
        <div className={theme.footer}>
          {policyRef && <span className={`${theme.chip} ${theme.chipMono}`}>{policyRef}</span>}
          {badges?.map((badge, i) => (
            <span key={`${badge}-${i}`} className={theme.chip}>
              {badge}
            </span>
          ))}
        </div>
      )}
      {renderHandles(sourceHandles, "source")}
    </div>
  );
}
