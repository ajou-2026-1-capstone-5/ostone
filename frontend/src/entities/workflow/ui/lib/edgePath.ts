import type { GraphNodeType } from "./parseGraph";

export interface EdgePoint {
  x: number;
  y: number;
}

export const NODE_WIDTH = 56;
export const NODE_HEIGHT = 26;

export function nodeAnchor(
  type: GraphNodeType,
  center: EdgePoint,
  toward: EdgePoint,
): EdgePoint {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return center;
  const ux = dx / len;
  const uy = dy / len;
  if (type === "TERMINAL" || type === "START") {
    const r = NODE_HEIGHT / 2 + 2;
    return { x: center.x + ux * r, y: center.y + uy * r };
  }
  if (type === "DECISION") {
    const halfW = NODE_WIDTH * 0.55;
    const halfH = NODE_HEIGHT * 0.85;
    const t = 1 / (Math.abs(ux) / halfW + Math.abs(uy) / halfH || 1);
    return { x: center.x + ux * t, y: center.y + uy * t };
  }
  const halfW = NODE_WIDTH / 2;
  const halfH = NODE_HEIGHT / 2;
  const tx = halfW / Math.max(Math.abs(ux), 0.0001);
  const ty = halfH / Math.max(Math.abs(uy), 0.0001);
  const t = Math.min(tx, ty);
  return { x: center.x + ux * t, y: center.y + uy * t };
}

export function buildEdgePath(start: EdgePoint, end: EdgePoint, sameLayer: boolean): string {
  if (sameLayer) {
    const midX = (start.x + end.x) / 2;
    const offset = Math.max(40, Math.abs(end.y - start.y) * 0.4);
    return `M ${start.x} ${start.y} C ${midX + offset} ${start.y}, ${midX + offset} ${end.y}, ${end.x} ${end.y}`;
  }
  const midX = (start.x + end.x) / 2;
  return `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
}

export function edgeLabelPoint(start: EdgePoint, end: EdgePoint): EdgePoint {
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 6 };
}
