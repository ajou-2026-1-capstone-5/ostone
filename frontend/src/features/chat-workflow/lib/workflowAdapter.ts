import type { WorkflowGraph, GraphNode, GraphEdge } from '@/entities/workflow';
import type { DemoWorkflow } from '../model/chatWorkflow.types';

export function adaptDemoWorkflow(
  demo: DemoWorkflow | null | undefined,
): WorkflowGraph {
  if (!demo || !Array.isArray(demo.states) || !Array.isArray(demo.transitions)) {
    return { direction: 'LR', nodes: [], edges: [] };
  }

  const nodes: GraphNode[] = demo.states.map((state) => ({
    id: state,
    label: state,
    type: 'ACTION',
  }));

  const edges: GraphEdge[] = demo.transitions.map((t, index) => ({
    id: `${t.from}-${t.to}-${index}`,
    from: t.from,
    to: t.to,
    label: t.on,
  }));

  return { direction: 'LR', nodes, edges };
}
