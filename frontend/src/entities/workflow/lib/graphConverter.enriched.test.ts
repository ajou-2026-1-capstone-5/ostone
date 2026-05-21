import { describe, expect, it } from "vitest";
import type { WorkflowGraph } from "../model/types";
import { toFlow } from "./graphConverter";

describe("toFlow — enriched node data passthrough", () => {
  const baseGraph = (overrides: Partial<WorkflowGraph["nodes"][number]>): WorkflowGraph => ({
    direction: "LR",
    nodes: [
      {
        id: "n1",
        type: "ACTION",
        label: "Act",
        ...overrides,
      },
    ],
    edges: [],
  });

  it("passes description into node.data", () => {
    const { nodes } = toFlow(baseGraph({ description: "노드 설명" }));
    expect((nodes[0].data as { description?: string }).description).toBe("노드 설명");
  });

  it("passes iconHint into node.data", () => {
    const { nodes } = toFlow(baseGraph({ iconHint: "Zap" }));
    expect((nodes[0].data as { iconHint?: string }).iconHint).toBe("Zap");
  });

  it("passes badges into node.data", () => {
    const { nodes } = toFlow(baseGraph({ badges: ["a", "b"] }));
    expect((nodes[0].data as { badges?: string[] }).badges).toEqual(["a", "b"]);
  });

  it("passes accentColor into node.data", () => {
    const { nodes } = toFlow(baseGraph({ accentColor: "violet" }));
    expect((nodes[0].data as { accentColor?: string }).accentColor).toBe("violet");
  });

  it("passes meta into node.data", () => {
    const { nodes } = toFlow(baseGraph({ meta: { channel: "kakao" } }));
    expect((nodes[0].data as { meta?: Record<string, string> }).meta).toEqual({
      channel: "kakao",
    });
  });

  it("passes status into node.data", () => {
    const { nodes } = toFlow(baseGraph({ status: "COMPLETED" }));
    expect((nodes[0].data as { status?: string }).status).toBe("COMPLETED");
  });

  it("omits enrich fields when source does not provide them (backward compat)", () => {
    const { nodes } = toFlow(baseGraph({}));
    const data = nodes[0].data as Record<string, unknown>;
    expect(data.description).toBeUndefined();
    expect(data.iconHint).toBeUndefined();
    expect(data.badges).toBeUndefined();
    expect(data.accentColor).toBeUndefined();
    expect(data.meta).toBeUndefined();
    expect(data.status).toBeUndefined();
  });

  it("retains policyRef for ACTION nodes alongside enrich fields", () => {
    const { nodes } = toFlow(
      baseGraph({ policyRef: "PR-014", description: "set priority", iconHint: "Zap" }),
    );
    const data = nodes[0].data as { policyRef?: string; description?: string; iconHint?: string };
    expect(data.policyRef).toBe("PR-014");
    expect(data.description).toBe("set priority");
    expect(data.iconHint).toBe("Zap");
  });

  it("supports enrich fields on non-ACTION nodes", () => {
    const graph: WorkflowGraph = {
      direction: "LR",
      nodes: [
        {
          id: "n1",
          type: "START",
          label: "Start",
          description: "trigger",
          badges: ["once"],
          accentColor: "violet",
          status: "ACTIVE",
        },
      ],
      edges: [],
    };
    const { nodes } = toFlow(graph);
    const data = nodes[0].data as Record<string, unknown>;
    expect(data.description).toBe("trigger");
    expect(data.badges).toEqual(["once"]);
    expect(data.accentColor).toBe("violet");
    expect(data.status).toBe("ACTIVE");
  });
});
