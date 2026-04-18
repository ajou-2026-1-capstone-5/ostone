import type { Node, Edge } from '@xyflow/react';
import type { WorkflowGraph } from '../../../entities/workflow/model/types';

const H_SPACING = 220;
const V_SPACING = 130;

function layout(i: number, graph: WorkflowGraph): { x: number; y: number } {
  const total = graph.nodes.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const col = i % cols;
  const row = Math.floor(i / cols);
  return { x: col * H_SPACING, y: row * V_SPACING };
}

const mapNodeType = (type: WorkflowGraph['nodes'][number]['type']) => type.toLowerCase();

export function toFlow(graph: WorkflowGraph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n, i) => ({
    id: n.id,
    type: mapNodeType(n.type),
    data: { label: n.label },
    position: layout(i, graph),
  }));

  const edgeIdCounts = new Map<string, number>();
  const edges: Edge[] = graph.edges.map((e) => {
    const baseId = `${e.from}->${e.to}:${e.label ?? 'unlabeled'}`;
    const count = edgeIdCounts.get(baseId) ?? 0;
    edgeIdCounts.set(baseId, count + 1);

    return {
      id: `${baseId}#${count + 1}`,
      source: e.from,
      target: e.to,
      label: e.label ?? undefined,
    };
  });

  return { nodes, edges };
}
