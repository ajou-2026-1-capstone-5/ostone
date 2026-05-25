import { describe, expect, it } from "vitest";

import { buildEdgePath, edgeLabelPoint, nodeAnchor, NODE_HEIGHT, NODE_WIDTH } from "./edgePath";

describe("nodeAnchor", () => {
  it("같은 중심점이면 center 반환", () => {
    expect(nodeAnchor("ACTION", { x: 10, y: 10 }, { x: 10, y: 10 })).toEqual({ x: 10, y: 10 });
  });

  it("ACTION 박스는 가로 anchor가 NODE_WIDTH/2 이내", () => {
    const anchor = nodeAnchor("ACTION", { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(anchor.x).toBeCloseTo(NODE_WIDTH / 2);
  });

  it("TERMINAL은 반지름 기반 anchor", () => {
    const anchor = nodeAnchor("TERMINAL", { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(anchor.x).toBeCloseTo(NODE_HEIGHT / 2 + 2);
  });

  it("DECISION 다이아몬드 anchor", () => {
    const anchor = nodeAnchor("DECISION", { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(anchor.x).toBeGreaterThan(0);
    expect(anchor.x).toBeLessThan(NODE_WIDTH);
  });
});

describe("buildEdgePath", () => {
  it("normal direction은 단일 cubic", () => {
    const path = buildEdgePath({ x: 0, y: 0 }, { x: 100, y: 0 }, false);
    expect(path.startsWith("M 0 0")).toBe(true);
    expect(path).toContain("C");
  });

  it("같은 layer는 bowing offset 적용", () => {
    const normal = buildEdgePath({ x: 0, y: 0 }, { x: 0, y: 100 }, false);
    const bowed = buildEdgePath({ x: 0, y: 0 }, { x: 0, y: 100 }, true);
    expect(bowed).not.toEqual(normal);
  });
});

describe("edgeLabelPoint", () => {
  it("두 점의 중간 위치 + offset", () => {
    const p = edgeLabelPoint({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(p.x).toBe(50);
    expect(p.y).toBe(-6);
  });
});
