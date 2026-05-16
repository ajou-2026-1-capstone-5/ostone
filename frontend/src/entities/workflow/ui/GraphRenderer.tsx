import { useMemo } from "react";
import { ReactFlow, Background, Controls, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowGraph } from "@/entities/workflow";
import { toFlow } from "@/entities/workflow";
import { StartNode } from "./nodes/StartNode";
import { ActionNode } from "./nodes/ActionNode";
import { DecisionNode } from "./nodes/DecisionNode";
import { AnswerNode } from "./nodes/AnswerNode";
import { HandoffNode } from "./nodes/HandoffNode";
import { TerminalNode } from "./nodes/TerminalNode";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";
import styles from "./GraphRenderer.module.css";

const nodeTypes: NodeTypes = {
  start: StartNode as React.ComponentType<any>,
  action: ActionNode as React.ComponentType<any>,
  decision: DecisionNode as React.ComponentType<any>,
  answer: AnswerNode as React.ComponentType<any>,
  handoff: HandoffNode as React.ComponentType<any>,
  terminal: TerminalNode as React.ComponentType<any>,
};

interface GraphRendererProps {
  graph: WorkflowGraph;
  onEdgeClick?: (edgeId: string) => void;
  onPaneClick?: () => void;
  selectedNodeIds?: readonly string[];
  onNodeSelect?: (nodeId: string) => void;
  currentNodeId?: string;
  isLoading?: boolean;
  error?: Error | string | null;
  emptyMessage?: string;
}

export default function GraphRenderer({ graph, onEdgeClick, onPaneClick, selectedNodeIds, onNodeSelect, currentNodeId, isLoading, error, emptyMessage }: GraphRendererProps) {
  const { nodes, edges } = useMemo(() => {
    const flow = toFlow(graph);
    const selectedSet = selectedNodeIds?.length ? new Set(selectedNodeIds) : null;
    return {
      nodes: flow.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          selected: selectedSet?.has(node.id) ? true : undefined,
          current: node.id === currentNodeId ? true : undefined,
        },
      })),
      edges: flow.edges,
    };
  }, [graph, selectedNodeIds, currentNodeId]);

  return (
    <div className={styles.container}>
      {isLoading ? (
        <div className={styles.loading}>Loading workflow...</div>
      ) : error ? (
        <div className={styles.error}>Error: {typeof error === "string" ? error : error.message}</div>
      ) : !nodes || nodes.length === 0 ? (
        <div className={styles.empty}>{emptyMessage ?? "No workflow data"}</div>
      ) : (
        <ErrorBoundary fallback={<div className={styles.error}>Something went wrong</div>}>
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
        </ErrorBoundary>
      )}
    </div>
  );
}
