// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Closure variable to control edges in each test
let testEdges: unknown[] = [];
let capturedComparator: ((a: unknown, b: unknown) => boolean) | undefined;

vi.mock("@xyflow/react", () => ({
  useStore: (
    selector: (s: { edges: unknown[] }) => unknown,
    comparator?: (a: unknown, b: unknown) => boolean,
  ) => {
    capturedComparator = comparator;
    return selector({ edges: testEdges });
  },
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

import { useConnectedSides } from "./useConnectedSides";

interface Edge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

const edge = (id: string, src: string, sh: string, tgt: string, th: string): Edge => ({
  id,
  source: src,
  sourceHandle: sh,
  target: tgt,
  targetHandle: th,
});

describe("useConnectedSides", () => {
  it("엣지가 없으면 sources와 targets가 빈 배열이다", () => {
    testEdges = [];
    expect(useConnectedSides("n1")).toEqual({ sources: [], targets: [] });
  });

  it("source 엣지가 있으면 sources에 해당 side가 포함된다", () => {
    testEdges = [edge("e1", "n1", "right", "n2", "left")];
    const result = useConnectedSides("n1");
    expect(result.sources).toContain("right");
    expect(result.targets).toEqual([]);
  });

  it("target 엣지가 있으면 targets에 해당 side가 포함된다", () => {
    testEdges = [edge("e1", "n2", "right", "n1", "left")];
    const result = useConnectedSides("n1");
    expect(result.targets).toContain("left");
    expect(result.sources).toEqual([]);
  });

  it("유효하지 않은 side는 무시한다", () => {
    testEdges = [edge("e1", "n1", "invalid-side", "n2", "also-invalid")];
    expect(useConnectedSides("n1")).toEqual({ sources: [], targets: [] });
  });

  it("같은 side의 중복 엣지가 있어도 한 번만 반환한다", () => {
    testEdges = [
      edge("e1", "n1", "right", "n2", "left"),
      edge("e2", "n1", "right", "n3", "top"),
    ];
    const result = useConnectedSides("n1");
    expect(result.sources.filter((s) => s === "right")).toHaveLength(1);
  });

  it("여러 방향의 source와 target 엣지를 모두 수집한다", () => {
    testEdges = [
      edge("e1", "n1", "right", "n2", "left"),
      edge("e2", "n3", "bottom", "n1", "top"),
    ];
    const result = useConnectedSides("n1");
    expect(result.sources).toContain("right");
    expect(result.targets).toContain("top");
  });

  it("다른 노드의 엣지는 무시한다", () => {
    testEdges = [edge("e1", "n2", "right", "n3", "left")];
    expect(useConnectedSides("n1")).toEqual({ sources: [], targets: [] });
  });
});

describe("useConnectedSides — comparator (memoization equality fn)", () => {
  it("sources·targets가 동일하면 true를 반환한다", () => {
    testEdges = [edge("e1", "n1", "right", "n2", "left")];
    useConnectedSides("n1");
    const state = { sources: ["right"], targets: ["left"] };
    expect(capturedComparator?.(state, state)).toBe(true);
  });

  it("sources 개수가 다르면 false를 반환한다", () => {
    testEdges = [];
    useConnectedSides("n1");
    const a = { sources: ["right"], targets: [] };
    const b = { sources: [], targets: [] };
    expect(capturedComparator?.(a, b)).toBe(false);
  });

  it("targets 원소가 다르면 false를 반환한다", () => {
    testEdges = [];
    useConnectedSides("n1");
    const a = { sources: [], targets: ["left"] };
    const b = { sources: [], targets: ["right"] };
    expect(capturedComparator?.(a, b)).toBe(false);
  });
});
