import type { IntentSummary, IntentTreeNode } from "../../../entities/intent";

export function buildIntentTree(items: IntentSummary[]): IntentTreeNode[] {
  const nodeMap = new Map<number, IntentTreeNode>();
  const itemMap = new Map<number, IntentSummary>();
  const orderedItems: IntentSummary[] = [];

  for (const item of items) {
    if (nodeMap.has(item.id)) {
      continue;
    }

    nodeMap.set(item.id, { ...item, children: [] });
    itemMap.set(item.id, item);
    orderedItems.push(item);
  }

  const roots: IntentTreeNode[] = [];

  for (const item of orderedItems) {
    const node = nodeMap.get(item.id);
    if (!node) continue;

    const parent = item.parentIntentId === null ? undefined : nodeMap.get(item.parentIntentId);

    if (!parent || createsCycle(parent.id, node.id, itemMap)) {
      roots.push(node);
      continue;
    }

    parent.children.push(node);
  }

  return roots;
}

function createsCycle(
  candidateParentId: number,
  nodeId: number,
  itemMap: Map<number, IntentSummary>,
): boolean {
  const visited = new Set<number>();
  let currentId: number | null = candidateParentId;

  while (currentId !== null) {
    if (currentId === nodeId || visited.has(currentId)) {
      return true;
    }

    visited.add(currentId);
    currentId = itemMap.get(currentId)?.parentIntentId ?? null;
  }

  return false;
}
