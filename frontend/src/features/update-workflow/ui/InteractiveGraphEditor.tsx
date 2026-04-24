import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
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
import type { GraphNodeType, WorkflowGraph } from "@/entities/workflow";
import { EditableStartNode } from "./nodes/EditableStartNode";
import { EditableActionNode } from "./nodes/EditableActionNode";
import { EditableDecisionNode } from "./nodes/EditableDecisionNode";
import { EditableAnswerNode } from "./nodes/EditableAnswerNode";
import { EditableHandoffNode } from "./nodes/EditableHandoffNode";
import { EditableTerminalNode } from "./nodes/EditableTerminalNode";
import { EditableEdge } from "./edges/EditableEdge";
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
  default: EditableEdge,
};

interface InteractiveGraphEditorCoreProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onStateChange: (nodes: Node[], edges: Edge[]) => void;
}

function InteractiveGraphEditorCore({
  initialNodes,
  initialEdges,
  onStateChange,
}: InteractiveGraphEditorCoreProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    onStateChange(nodes, edges);
  }, [nodes, edges, onStateChange]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => addEdge({ ...params, id: crypto.randomUUID() }, eds)),
    [setEdges],
  );

  const handleAddNode = useCallback(
    (type: GraphNodeType) => {
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const id = crypto.randomUUID();
      const newNode: Node = {
        id,
        type: type.toLowerCase(),
        data: {
          label: type,
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
      <AddNodeToolbar onAddNode={handleAddNode} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          deleteKeyCode="Delete"
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
  direction: WorkflowGraph["direction"];
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
