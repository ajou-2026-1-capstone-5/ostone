import '@xyflow/react/dist/style.css';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import type { WorkflowGraph } from '../../../entities/workflow/model/types';
import { toFlow } from './graphMapper';
import { StartNode } from './nodes/StartNode';
import { ActionNode } from './nodes/ActionNode';
import { DecisionNode } from './nodes/DecisionNode';
import { AnswerNode } from './nodes/AnswerNode';
import { HandoffNode } from './nodes/HandoffNode';
import { TerminalNode } from './nodes/TerminalNode';
import styles from './graph-renderer.module.css';

const nodeTypes = {
  start: StartNode,
  action: ActionNode,
  decision: DecisionNode,
  answer: AnswerNode,
  handoff: HandoffNode,
  terminal: TerminalNode,
};

interface GraphRendererProps {
  graph: WorkflowGraph;
}

function GraphRenderer({ graph }: GraphRendererProps) {
  const { nodes, edges } = toFlow(graph);

  return (
    <div className={styles.container}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} color="var(--glass-dark)" />
        <Controls showInteractive={false} className={styles.controls} />
      </ReactFlow>
    </div>
  );
}

export default GraphRenderer;
