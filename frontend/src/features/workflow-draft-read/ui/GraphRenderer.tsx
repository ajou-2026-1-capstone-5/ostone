import { useMemo } from "react";
import { ReactFlow, Background, Controls, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowGraph } from "@/entities/workflow";
import { toFlow } from "./graphMapper";
import { StartNode } from "./nodes/StartNode";
import { ActionNode } from "./nodes/ActionNode";
import { DecisionNode } from "./nodes/DecisionNode";
import { AnswerNode } from "./nodes/AnswerNode";
import { HandoffNode } from "./nodes/HandoffNode";
import { TerminalNode } from "./nodes/TerminalNode";
import styles from "./GraphRenderer.module.css";

const nodeTypes: NodeTypes = {
  start: StartNode,
  action: ActionNode,
  decision: DecisionNode,
  answer: AnswerNode,
  handoff: HandoffNode,
  terminal: TerminalNode,
};

interface GraphRendererProps {
  graph: WorkflowGraph;
  onEdgeClick?: (edgeId: string) => void;
  onPaneClick?: () => void;
  selectedNodeIds?: readonly string[];
  onNodeSelect?: (nodeId: string) => void;
}

export default function GraphRenderer({ graph, onEdgeClick, onPaneClick, selectedNodeIds, onNodeSelect }: GraphRendererProps) {
  const { nodes, edges } = useMemo(() => {
    const flow = toFlow(graph);
    if (selectedNodeIds && selectedNodeIds.length > 0) {
      const selectedSet = new Set(selectedNodeIds);
      return {
        nodes: flow.nodes.map((node) => ({
          ...node,
          data: { ...node.data, selected: selectedSet.has(node.id) ? true : undefined },
        })),
        edges: flow.edges,
      };
    }
    return flow;
  }, [graph, selectedNodeIds]);

  return (
    <div className={styles.container}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        panOnDrag={true}
        zoomOnScroll={true}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onEdgeClick={(_, edge) => onEdgeClick?.(edge.id)}
        onPaneClick={onPaneClick}
        onNodeClick={(_, node) => onNodeSelect?.(node.id)}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
