import { useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowGraph } from "@/entities/workflow";
import { toFlow } from "@/entities/workflow/lib/graphConverter";
import { FitOnInit, FIT_OPTIONS } from "@/shared/ui/react-flow/FitOnInit";
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

function GraphViewerCore({ graph, onEdgeClick, onPaneClick }: GraphViewerProps) {
  const { nodes, edges: rawEdges } = useMemo(() => toFlow(graph), [graph]);
  const edges = useMemo(
    () =>
      rawEdges.map((e) => ({
        ...e,
        type: "plain" as const,
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    [rawEdges],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={FIT_OPTIONS}
      minZoom={0.15}
      maxZoom={2}
      panOnDrag={true}
      zoomOnScroll={false}
      zoomOnPinch={true}
      zoomOnDoubleClick={true}
      preventScrolling={false}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      onEdgeClick={(_, edge) => onEdgeClick?.(edge.id)}
      onPaneClick={onPaneClick}
    >
      <FitOnInit />
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1.5}
        color="var(--node-canvas-dot)"
      />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

export function GraphViewer(props: GraphViewerProps) {
  return (
    <div className={styles.container}>
      <ReactFlowProvider>
        <GraphViewerCore {...props} />
      </ReactFlowProvider>
    </div>
  );
}
