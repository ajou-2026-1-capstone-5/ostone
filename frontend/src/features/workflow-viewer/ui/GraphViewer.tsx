import { useMemo } from "react";
import { ReactFlow, Background, Controls, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowGraph } from "@/entities/workflow";
import { toFlow } from "@/entities/workflow/lib/graphConverter";
import { StartNode } from "./nodes/StartNode";
import { ActionNode } from "./nodes/ActionNode";
import { DecisionNode } from "./nodes/DecisionNode";
import { AnswerNode } from "./nodes/AnswerNode";
import { HandoffNode } from "./nodes/HandoffNode";
import { TerminalNode } from "./nodes/TerminalNode";
import { PlainEdge } from "./edges/PlainEdge";
import styles from "./GraphViewer.module.css";

const nodeTypes: NodeTypes = {
  start: StartNode,
  action: ActionNode,
  decision: DecisionNode,
  answer: AnswerNode,
  handoff: HandoffNode,
  terminal: TerminalNode,
};

const edgeTypes = {
  plain: PlainEdge,
};

interface GraphViewerProps {
  graph: WorkflowGraph;
  onEdgeClick?: (edgeId: string) => void;
  onPaneClick?: () => void;
}

export default function GraphViewer({
  graph,
  onEdgeClick,
  onPaneClick,
}: GraphViewerProps) {
  const { nodes, edges: rawEdges } = useMemo(() => toFlow(graph), [graph]);
  const edges = useMemo(
    () => rawEdges.map((e) => ({ ...e, type: "plain" as const })),
    [rawEdges],
  );

  return (
    <div className={styles.container}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        panOnDrag={true}
        zoomOnScroll={true}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onEdgeClick={(_, edge) => onEdgeClick?.(edge.id)}
        onPaneClick={onPaneClick}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
