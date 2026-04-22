import type { IntentSummary, IntentTreeNode } from "../../../entities/intent";

export function buildIntentTree(items: IntentSummary[]): IntentTreeNode[] {
  const nodeMap = new Map<number, IntentTreeNode>();

  for (const item of items) {
    nodeMap.set(item.id, { ...item, children: [] });
  }

  const roots: IntentTreeNode[] = [];

  for (const item of items) {
    const node = nodeMap.get(item.id);
    if (!node) continue;

    const parent = item.parentIntentId === null ? undefined : nodeMap.get(item.parentIntentId);

    if (!parent || parent.id === node.id) {
      roots.push(node);
      continue;
    }

    parent.children.push(node);
  }

  return roots;
}
