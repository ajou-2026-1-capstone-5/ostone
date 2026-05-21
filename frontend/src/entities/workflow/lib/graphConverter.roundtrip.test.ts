import { describe, expect, it } from "vitest";
import type { WorkflowGraph } from "../model/types";
import { toFlow, convertFlowToWorkflowGraph } from "./graphConverter";

describe("graphConverter round-trip (editor → save preserves optional fields)", () => {
  it("preserves every optional node field through toFlow + convertFlowToWorkflowGraph", () => {
    const graph: WorkflowGraph = {
      direction: "LR",
      nodes: [
        {
          id: "n1",
          type: "ACTION",
          label: "잠금 해제",
          policyRef: "ACT-UNLOCK-001",
          description: "계정 자동 잠금 해제",
          iconHint: "Zap",
          badges: ["policy:unlock", "audit:on"],
          accentColor: "indigo",
          meta: { policy: "auto_unlock", audit: "on" },
          status: "IDLE",
          position: { x: 760, y: 60 },
        },
      ],
      edges: [],
    };
    const flow = toFlow(graph);
    const back = convertFlowToWorkflowGraph(flow.nodes, flow.edges);
    expect(back.nodes[0]).toMatchObject({
      id: "n1",
      type: "ACTION",
      label: "잠금 해제",
      policyRef: "ACT-UNLOCK-001",
      description: "계정 자동 잠금 해제",
      iconHint: "Zap",
      badges: ["policy:unlock", "audit:on"],
      accentColor: "indigo",
      meta: { policy: "auto_unlock", audit: "on" },
      status: "IDLE",
      position: { x: 760, y: 60 },
    });
  });

  it("preserves edge sourceHandle / targetHandle hints", () => {
    const graph: WorkflowGraph = {
      direction: "LR",
      nodes: [
        { id: "a", type: "DECISION", label: "분기", position: { x: 0, y: 0 } },
        { id: "b", type: "ACTION", label: "처리", position: { x: 400, y: 0 } },
      ],
      edges: [
        {
          id: "e1",
          from: "a",
          to: "b",
          label: "yes",
          sourceHandle: "top",
          targetHandle: "left",
        },
      ],
    };
    const flow = toFlow(graph);
    const back = convertFlowToWorkflowGraph(flow.nodes, flow.edges);
    expect(back.edges[0]).toEqual({
      id: "e1",
      from: "a",
      to: "b",
      label: "yes",
      sourceHandle: "top",
      targetHandle: "left",
    });
  });

  it("drops invalid optional values silently (defence in depth)", () => {
    const flow = {
      nodes: [
        {
          id: "n1",
          type: "ACTION",
          data: {
            label: "X",
            accentColor: "not-a-real-color",
            status: "BOGUS",
            badges: [123, "ok", null],
          },
          position: { x: 10, y: 20 },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "n1",
          target: "n2",
          sourceHandle: "diagonal",
          targetHandle: "left",
        },
      ],
    };
    const back = convertFlowToWorkflowGraph(
      flow.nodes as unknown as Parameters<typeof convertFlowToWorkflowGraph>[0],
      flow.edges as unknown as Parameters<typeof convertFlowToWorkflowGraph>[1],
    );
    expect(back.nodes[0].accentColor).toBeUndefined();
    expect(back.nodes[0].status).toBeUndefined();
    expect(back.nodes[0].badges).toEqual(["ok"]); // strings only
    expect(back.nodes[0].position).toEqual({ x: 10, y: 20 });
    expect(back.edges[0].sourceHandle).toBeUndefined();
    expect(back.edges[0].targetHandle).toBe("left");
  });
});
