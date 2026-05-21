import { Handle, type NodeProps } from "@xyflow/react";
import { SIDE_TO_POSITION } from "@/entities/workflow/lib/handleUtils";
import theme from "@/shared/styles/workflow-node-theme.module.css";
import { readString, renderNodeIcon } from "../nodeStyles";
import { useConnectedSides } from "./useConnectedSides";

export function TerminalNode({ id, data }: NodeProps) {
  const label = readString(data, "label") ?? "";
  const description = readString(data, "description");
  const iconHint = readString(data, "iconHint");
  const connected = useConnectedSides(id);

  return (
    <div className={theme.terminal} data-testid="terminal-node">
      {connected.targets.map((side) => (
        <Handle
          key={`target-${side}`}
          id={side}
          type="target"
          position={SIDE_TO_POSITION[side]}
          className={theme.handle}
          isConnectable={false}
        />
      ))}
      {renderNodeIcon("TERMINAL", iconHint, { size: 18, className: theme.terminalIcon })}
      <span className={theme.terminalTitle}>{label}</span>
      {description && <span className={theme.terminalSub}>{description}</span>}
    </div>
  );
}
