import { describe, expect, it } from "vitest";

import { layoutDag } from "./dagLayout";
import type { ParsedEdge, ParsedNode } from "./parseGraph";

function n(id: string, x: number | null = null, y: number | null = null): ParsedNode {
  return { id, label: id, type: "ACTION", x, y };
}

function e(from: string, to: string, id?: string): ParsedEdge {
  return { id: id ?? `${from}→${to}`, from, to, label: null };
}

describe("layoutDag", () => {
  it("빈 입력 → 빈 결과", () => {
    expect(layoutDag([], [])).toEqual({ nodes: [], hasCycle: false });
  });

  it("position이 모두 있으면 원본 좌표 그대로 사용", () => {
    const nodes = [n("a", 100, 50), n("b", 200, 60)];
    const out = layoutDag(nodes, [e("a", "b")]);
    expect(out.hasCycle).toBe(false);
    expect(out.nodes.find((x) => x.id === "a")).toMatchObject({ x: 100, y: 50 });
    expect(out.nodes.find((x) => x.id === "b")).toMatchObject({ x: 200, y: 60 });
  });

  it("position이 일부라도 누락되면 전체 자동 레이아웃 적용", () => {
    const nodes = [n("a", 100, 50), n("b") /* missing */];
    const out = layoutDag(nodes, [e("a", "b")]);
    const a = out.nodes.find((x) => x.id === "a")!;
    const b = out.nodes.find((x) => x.id === "b")!;
    expect(a.x).toBe(0);
    expect(b.x).toBeGreaterThan(a.x);
  });

  it("DAG는 위상 정렬로 layer 배치", () => {
    const nodes = [n("a"), n("b"), n("c"), n("d")];
    const out = layoutDag(nodes, [e("a", "b"), e("b", "c"), e("b", "d")]);
    expect(out.hasCycle).toBe(false);
    const a = out.nodes.find((x) => x.id === "a")!;
    const b = out.nodes.find((x) => x.id === "b")!;
    const c = out.nodes.find((x) => x.id === "c")!;
    const d = out.nodes.find((x) => x.id === "d")!;
    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);
    expect(c.x).toBe(d.x);
    expect(c.y).not.toBe(d.y);
  });

  it("사이클 그래프는 hasCycle=true + 모든 노드 배치", () => {
    const nodes = [n("a"), n("b"), n("c")];
    const out = layoutDag(nodes, [e("a", "b"), e("b", "c"), e("c", "a")]);
    expect(out.hasCycle).toBe(true);
    expect(out.nodes).toHaveLength(3);
  });

  it("orphan node도 배치", () => {
    const nodes = [n("a"), n("b")];
    const out = layoutDag(nodes, []);
    expect(out.nodes).toHaveLength(2);
  });

  it("100개 이상 노드도 처리 가능", () => {
    const nodes: ParsedNode[] = Array.from({ length: 120 }, (_, i) => n(`n${i}`));
    const edges: ParsedEdge[] = Array.from({ length: 119 }, (_, i) => e(`n${i}`, `n${i + 1}`));
    const out = layoutDag(nodes, edges);
    expect(out.nodes).toHaveLength(120);
    expect(out.hasCycle).toBe(false);
  });
});
