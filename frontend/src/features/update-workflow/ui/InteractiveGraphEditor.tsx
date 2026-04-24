import { useCallback, useEffect, useMemo, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MarkerType,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphNodeType } from "@/entities/workflow";
import { EditableStartNode } from "./nodes/EditableStartNode";
import { EditableActionNode } from "./nodes/EditableActionNode";
import { EditableDecisionNode } from "./nodes/EditableDecisionNode";
import { EditableAnswerNode } from "./nodes/EditableAnswerNode";
import { EditableHandoffNode } from "./nodes/EditableHandoffNode";
import { EditableTerminalNode } from "./nodes/EditableTerminalNode";
import { EditableEdge } from "./edges/EditableEdge";
import { PlainEdge } from "./edges/PlainEdge";
import { AddNodeToolbar } from "./AddNodeToolbar";

const nodeTypes: NodeTypes = {
  start: EditableStartNode,
  action: EditableActionNode,
  decision: EditableDecisionNode,
  answer: EditableAnswerNode,
  handoff: EditableHandoffNode,
  terminal: EditableTerminalNode,
};

const edgeTypes: EdgeTypes = {
  default: PlainEdge,
  decision: EditableEdge,
};

const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed },
};

function InteractiveGraphEditorCore({
  initialNodes,
  initialEdges,
  onStateChange,
}: InteractiveGraphEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition, getNode } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const prevSignatureRef = useRef("");

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const signature = JSON.stringify([
      nodes.map(({ id, data }) => ({ id, data })),
      edges.map(({ id, source, target, label, data }) => ({ id, source, target, label, data })),
    ]);
    if (signature === prevSignatureRef.current) return;
    prevSignatureRef.current = signature;
    onStateChange(nodes, edges);
  }, [nodes, edges, onStateChange]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => {
        const sourceNode = getNode(params.source);
        const edgeType = sourceNode?.type === "decision" ? "decision" : undefined;
        return addEdge({ ...params, id: uuidv4(), type: edgeType }, eds);
      }),
    [setEdges, getNode],
  );

  const hasStart = useMemo(() => nodes.some((n) => n.type === "start"), [nodes]);
  const disabledTypes = useMemo<GraphNodeType[]>(() => (hasStart ? ["START"] : []), [hasStart]);

  const handleAddNode = useCallback(
    (type: GraphNodeType) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const position = screenToFlowPosition({
        x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
        y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
      });
      const id = uuidv4();
      const newNode: Node = {
        id,
        type: type.toLowerCase(),
        data: {
          label: "",
          ...(type === "ACTION" ? { policyRef: "" } : {}),
        },
        position,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AddNodeToolbar onAddNode={handleAddNode} disabledTypes={disabledTypes} />
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          deleteKeyCode={["Delete", "Backspace"]}
          fitView
        >
          <Background gap={20} size={1} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export interface InteractiveGraphEditorProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  /** Do not perform heavy synchronous work here; called only on meaningful structural changes. */
  onStateChange: (nodes: Node[], edges: Edge[]) => void;
}

export function InteractiveGraphEditor({
  initialNodes,
  initialEdges,
  onStateChange,
}: InteractiveGraphEditorProps) {
  return (
    <ReactFlowProvider>
      <InteractiveGraphEditorCore
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        onStateChange={onStateChange}
      />
    </ReactFlowProvider>
  );
}
