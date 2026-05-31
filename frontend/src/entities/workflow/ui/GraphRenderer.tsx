import { useMemo } from "react";
import { ReactFlow, Background, Controls, type NodeProps, type NodeTypes } from "@xyflow/react";
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
  start: StartNode as React.ComponentType<NodeProps>,
  action: ActionNode as React.ComponentType<NodeProps>,
  decision: DecisionNode as React.ComponentType<NodeProps>,
  answer: AnswerNode as React.ComponentType<NodeProps>,
  handoff: HandoffNode as React.ComponentType<NodeProps>,
  terminal: TerminalNode as React.ComponentType<NodeProps>,
};

interface GraphRendererProps {
  readonly graph: WorkflowGraph;
  readonly onEdgeClick?: (edgeId: string) => void;
  readonly onPaneClick?: () => void;
  readonly selectedNodeIds?: readonly string[];
  readonly onNodeSelect?: (nodeId: string) => void;
  readonly currentNodeId?: string;
  readonly showEdgeLabels?: boolean;
  readonly isLoading?: boolean;
  readonly error?: Error | string | null;
  readonly emptyMessage?: string;
}

export default function GraphRenderer({
  graph,
  onEdgeClick,
  onPaneClick,
  selectedNodeIds,
  onNodeSelect,
  currentNodeId,
  showEdgeLabels = true,
  isLoading,
  error,
  emptyMessage,
}: GraphRendererProps) {
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
      edges: showEdgeLabels
        ? flow.edges
        : flow.edges.map((edge) => ({
            ...edge,
            label: undefined,
          })),
    };
  }, [graph, selectedNodeIds, currentNodeId, showEdgeLabels]);

  return (
    <div className={styles.container}>
      {isLoading ? (
        <div className={styles.loading}>응대 흐름을 불러오는 중...</div>
      ) : error ? (
        <div className={styles.error}>
          Error: {typeof error === "string" ? error : error.message}
        </div>
      ) : !nodes || nodes.length === 0 ? (
        <div className={styles.empty}>{emptyMessage ?? "응대 흐름 데이터 없음"}</div>
      ) : (
        <ErrorBoundary fallback={<div className={styles.error}>흐름도를 표시할 수 없습니다</div>}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.18 }}
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
