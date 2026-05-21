import { type NodeProps } from "@xyflow/react";
import theme from "@/shared/styles/workflow-node-theme.module.css";
import { readBadges, readString, renderNodeIcon } from "../nodeStyles";
import { NodeCardShell } from "./NodeCardShell";
import { useConnectedSides } from "./useConnectedSides";

export function DecisionNode({ id, data }: NodeProps) {
  const label = readString(data, "label") ?? "";
  const description = readString(data, "description");
  const iconHint = readString(data, "iconHint");
  const badges = readBadges(data);
  const connected = useConnectedSides(id);

  return (
    <NodeCardShell
      kindClassName={theme.decision}
      icon={renderNodeIcon("DECISION", iconHint)}
      title={label}
      description={description}
      badges={badges}
      sourceHandles={connected.sources}
      targetHandles={connected.targets}
      containerTestId="decision-node"
    />
  );
}
