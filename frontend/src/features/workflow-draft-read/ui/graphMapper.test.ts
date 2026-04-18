import { describe, it, expect } from "vitest";
import { toFlow } from "./graphMapper";
import type { WorkflowGraph } from "../../../entities/workflow";

const baseGraph: WorkflowGraph = {
  direction: "LR",
  nodes: [
    { id: "n1", label: "Start", type: "START" },
    { id: "n2", label: "Action", type: "ACTION" },
  ],
  edges: [{ from: "n1", to: "n2", label: "next" }],
};

describe("toFlow", () => {
  it("노드 type을 소문자로 변환한다", () => {
    const { nodes } = toFlow(baseGraph);
    expect(nodes[0].type).toBe("start");
    expect(nodes[1].type).toBe("action");
  });

  it("노드 id를 그대로 유지한다", () => {
    const { nodes } = toFlow(baseGraph);
    expect(nodes[0].id).toBe("n1");
    expect(nodes[1].id).toBe("n2");
  });

  it("엣지 id에 순서 카운터가 포함된다", () => {
    const { edges } = toFlow(baseGraph);
    expect(edges[0].id).toBe("n1->n2:next#1");
  });

  it("동일 source→target+label 엣지가 중복되면 id가 달라진다", () => {
    const dupGraph: WorkflowGraph = {
      ...baseGraph,
      edges: [
        { from: "n1", to: "n2", label: "retry" },
        { from: "n1", to: "n2", label: "retry" },
      ],
    };
    const { edges } = toFlow(dupGraph);
    expect(edges[0].id).toBe("n1->n2:retry#1");
    expect(edges[1].id).toBe("n1->n2:retry#2");
  });

  it("label 없는 엣지에 'unlabeled' id가 사용된다", () => {
    const noLabelGraph: WorkflowGraph = {
      ...baseGraph,
      edges: [{ from: "n1", to: "n2" }],
    };
    const { edges } = toFlow(noLabelGraph);
    expect(edges[0].id).toBe("n1->n2:unlabeled#1");
  });

  it("TB 방향일 때 COLUMNS_FOR_TB(4) 기준으로 격자 위치를 계산한다", () => {
    const nodes = Array.from({ length: 5 }, (_, i) => ({
      id: `n${i}`,
      label: `N${i}`,
      type: "ACTION" as const,
    }));
    const tbGraph: WorkflowGraph = { direction: "TB", nodes, edges: [] };
    const { nodes: result } = toFlow(tbGraph);
    // index 4: col = 4 % 4 = 0, row = Math.floor(4/4) = 1
    expect(result[4].position).toEqual({ x: 0, y: 120 });
  });
});
