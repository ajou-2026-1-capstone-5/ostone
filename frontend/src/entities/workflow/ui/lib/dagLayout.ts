import type { ParsedEdge, ParsedNode } from "./parseGraph";

export interface LayoutNode extends ParsedNode {
  x: number;
  y: number;
}

export interface DagLayoutResult {
  nodes: LayoutNode[];
  hasCycle: boolean;
}

const LAYER_GAP_X = 110;
const NODE_GAP_Y = 56;

function hasMissingPosition(nodes: ParsedNode[]): boolean {
  return nodes.some((n) => n.x === null || n.y === null);
}

function computeLayers(
  nodes: ParsedNode[],
  edges: ParsedEdge[],
): { layers: string[][]; hasCycle: boolean } {
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const node of nodes) {
    indegree.set(node.id, 0);
    outgoing.set(node.id, []);
  }
  for (const edge of edges) {
    if (!indegree.has(edge.to) || !outgoing.has(edge.from)) continue;
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)!.push(edge.to);
  }

  const layers: string[][] = [];
  const placed = new Set<string>();
  let frontier = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  let hasCycle = false;
  if (frontier.length === 0 && nodes.length > 0) {
    hasCycle = true;
    frontier = [nodes[0].id];
  }
  while (frontier.length > 0) {
    layers.push(frontier);
    for (const id of frontier) placed.add(id);
    const nextSet = new Set<string>();
    for (const id of frontier) {
      for (const target of outgoing.get(id) ?? []) {
        const remaining = (indegree.get(target) ?? 0) - 1;
        indegree.set(target, remaining);
        if (remaining <= 0 && !placed.has(target)) {
          nextSet.add(target);
        }
      }
    }
    frontier = Array.from(nextSet);
  }

  const leftover = nodes.filter((n) => !placed.has(n.id)).map((n) => n.id);
  if (leftover.length > 0) {
    hasCycle = true;
    layers.push(leftover);
  }
  return { layers, hasCycle };
}

export function layoutDag(nodes: ParsedNode[], edges: ParsedEdge[]): DagLayoutResult {
  if (nodes.length === 0) {
    return { nodes: [], hasCycle: false };
  }
  if (!hasMissingPosition(nodes)) {
    return {
      nodes: nodes.map((n) => ({ ...n, x: n.x ?? 0, y: n.y ?? 0 })),
      hasCycle: false,
    };
  }
  const { layers, hasCycle } = computeLayers(nodes, edges);
  const placed: LayoutNode[] = [];
  for (let li = 0; li < layers.length; li += 1) {
    const layer = layers[li];
    const layerHeight = (layer.length - 1) * NODE_GAP_Y;
    layer.forEach((id, ni) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      placed.push({
        ...node,
        x: li * LAYER_GAP_X,
        y: ni * NODE_GAP_Y - layerHeight / 2,
      });
    });
  }
  return { nodes: placed, hasCycle };
}
