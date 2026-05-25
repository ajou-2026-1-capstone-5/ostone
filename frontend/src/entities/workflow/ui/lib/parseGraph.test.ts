import { describe, expect, it } from "vitest";

import { pickNodeType, safeParseGraph } from "./parseGraph";

describe("pickNodeType", () => {
  it("known type uppercase 처리", () => {
    expect(pickNodeType("start")).toBe("START");
    expect(pickNodeType("Decision")).toBe("DECISION");
    expect(pickNodeType("TERMINAL")).toBe("TERMINAL");
  });

  it("미지 / 비문자열은 UNKNOWN", () => {
    expect(pickNodeType("foo")).toBe("UNKNOWN");
    expect(pickNodeType(42)).toBe("UNKNOWN");
    expect(pickNodeType(null)).toBe("UNKNOWN");
    expect(pickNodeType(undefined)).toBe("UNKNOWN");
  });
});

describe("safeParseGraph", () => {
  it("null / undefined 입력은 빈 그래프", () => {
    expect(safeParseGraph(null)).toEqual({ nodes: [], edges: [] });
    expect(safeParseGraph(undefined)).toEqual({ nodes: [], edges: [] });
  });

  it("JSON 문자열 파싱", () => {
    const result = safeParseGraph(
      JSON.stringify({
        nodes: [{ id: "a", label: "A", type: "START" }],
        edges: [{ from: "a", to: "b", label: "yes" }],
      }),
    );
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe("START");
    expect(result.edges[0].label).toBe("yes");
  });

  it("잘못된 JSON 문자열은 빈 그래프", () => {
    expect(safeParseGraph("{not valid")).toEqual({ nodes: [], edges: [] });
  });

  it("source/target 별칭도 endpoint로 인식", () => {
    const r = safeParseGraph({
      nodes: [{ id: "a" }, { id: "b" }],
      edges: [{ source: "a", target: "b" }],
    });
    expect(r.edges).toHaveLength(1);
    expect(r.edges[0]).toMatchObject({ from: "a", to: "b" });
  });

  it("position 누락은 null로 유지", () => {
    const r = safeParseGraph({ nodes: [{ id: "a", label: "A" }] });
    expect(r.nodes[0].x).toBeNull();
    expect(r.nodes[0].y).toBeNull();
  });

  it("position 숫자만 유효", () => {
    const r = safeParseGraph({
      nodes: [{ id: "a", position: { x: 10, y: "bad" } }],
    });
    expect(r.nodes[0].x).toBe(10);
    expect(r.nodes[0].y).toBeNull();
  });

  it("edge 중복 id는 고유화", () => {
    const r = safeParseGraph({
      nodes: [{ id: "a" }, { id: "b" }],
      edges: [
        { id: "e1", from: "a", to: "b" },
        { id: "e1", from: "a", to: "b" },
      ],
    });
    expect(r.edges).toHaveLength(2);
    const ids = r.edges.map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("id 없는 node 또는 endpoint 누락 edge는 무시", () => {
    const r = safeParseGraph({
      nodes: [{ label: "no-id" }, { id: "a" }],
      edges: [{ to: "a" }, { from: "a" }, { from: "a", to: "" }, { from: "a", to: "b" }],
    });
    expect(r.nodes).toHaveLength(1);
    expect(r.edges).toHaveLength(1);
  });

  it("label 없을 때 id를 label로 사용", () => {
    const r = safeParseGraph({ nodes: [{ id: "foo" }] });
    expect(r.nodes[0].label).toBe("foo");
  });

  it("문자열 외 graphJson은 빈 그래프", () => {
    expect(safeParseGraph(42)).toEqual({ nodes: [], edges: [] });
    expect(safeParseGraph(true)).toEqual({ nodes: [], edges: [] });
  });
});
