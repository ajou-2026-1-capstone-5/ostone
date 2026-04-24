import { describe, it, expect } from "vitest";
import { toFlow } from "./graphMapper";
import type { WorkflowGraph } from "../../../entities/workflow";

const baseGraph: WorkflowGraph = {
  direction: "LR",
  nodes: [
    { id: "n1", label: "Start", type: "START" },
    { id: "n2", label: "Action", type: "ACTION" },
  ],
  edges: [{ id: "e1", from: "n1", to: "n2", label: "next" }],
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

  it("엣지 id에 GraphEdge.id를 그대로 사용한다", () => {
    const { edges } = toFlow(baseGraph);
    expect(edges[0].id).toBe("e1");
  });

  it("여러 엣지가 있을 때 각 GraphEdge.id를 그대로 사용한다", () => {
    const multiEdgeGraph: WorkflowGraph = {
      ...baseGraph,
      edges: [
        { id: "edge-a", from: "n1", to: "n2", label: "yes" },
        { id: "edge-b", from: "n1", to: "n2", label: "no" },
      ],
    };
    const { edges } = toFlow(multiEdgeGraph);
    expect(edges[0].id).toBe("edge-a");
    expect(edges[1].id).toBe("edge-b");
  });

  it("label 없는 엣지도 id가 그대로 사용된다", () => {
    const noLabelGraph: WorkflowGraph = {
      ...baseGraph,
      edges: [{ id: "e-no-label", from: "n1", to: "n2" }],
    };
    const { edges } = toFlow(noLabelGraph);
    expect(edges[0].id).toBe("e-no-label");
  });

  it("policyRef가 있는 ACTION 노드의 data에 policyRef가 포함된다", () => {
    const graphWithPolicyRef: WorkflowGraph = {
      direction: "LR",
      nodes: [
        { id: "n1", label: "Start", type: "START" },
        { id: "n2", label: "Action", type: "ACTION", policyRef: "POLICY_001" },
      ],
      edges: [{ id: "e1", from: "n1", to: "n2" }],
    };
    const { nodes } = toFlow(graphWithPolicyRef);
    expect(nodes[1].data.policyRef).toBe("POLICY_001");
  });

  it("policyRef 없는 노드의 data.policyRef는 undefined다", () => {
    const { nodes } = toFlow(baseGraph);
    expect(nodes[0].data.policyRef).toBeUndefined();
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
