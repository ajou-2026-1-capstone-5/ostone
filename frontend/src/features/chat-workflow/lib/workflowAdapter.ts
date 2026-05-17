import type { WorkflowGraph, GraphNode, GraphEdge } from '@/entities/workflow';
import type { DemoWorkflow } from '../model/chatWorkflow.types';

const NODE_GAP_X = 210;
const NODE_GAP_Y = 148;
const COLUMNS = 5;

function isHandoffState(state: string): boolean {
  return state === 'HANDED_OFF' || state === 'HANDOFF';
}

function nodeTypeForState(state: string, index: number): GraphNode['type'] {
  if (index === 0 || state === 'INITIAL') return 'START';
  if (state === 'COMPLETED') return 'TERMINAL';
  if (isHandoffState(state)) return 'HANDOFF';
  return 'ACTION';
}

function positionForState(index: number, state: string): GraphNode['position'] {
  if (isHandoffState(state)) {
    return { x: (COLUMNS - 1) * NODE_GAP_X, y: NODE_GAP_Y * 2 };
  }

  const row = Math.floor(index / COLUMNS);
  const columnInRow = index % COLUMNS;
  const x = row % 2 === 0
    ? columnInRow * NODE_GAP_X
    : (COLUMNS - 1 - columnInRow) * NODE_GAP_X;

  return { x, y: row * NODE_GAP_Y };
}

export function adaptDemoWorkflow(
  demo: DemoWorkflow | null | undefined,
): WorkflowGraph {
  if (!demo || !Array.isArray(demo.states) || !Array.isArray(demo.transitions)) {
    return { direction: 'LR', nodes: [], edges: [] };
  }

  const nodes: GraphNode[] = demo.states.map((state, index) => ({
    id: state,
    label: state,
    type: nodeTypeForState(state, index),
    position: positionForState(index, state),
  }));

  const edges: GraphEdge[] = demo.transitions.map((t, index) => ({
    id: `${t.from}-${t.to}-${index}`,
    from: t.from,
    to: t.to,
    label: t.on,
  }));

  return { direction: 'LR', nodes, edges };
}
