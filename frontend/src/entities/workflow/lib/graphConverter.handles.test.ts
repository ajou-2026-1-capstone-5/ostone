import { describe, expect, it } from "vitest";
import { autoHandleSides, toFlow } from "./graphConverter";
import type { WorkflowGraph } from "../model/types";

describe("autoHandleSides", () => {
  it("prefers right/left when target is to the right", () => {
    expect(autoHandleSides({ x: 0, y: 0 }, { x: 300, y: 0 })).toEqual(["right", "left"]);
  });

  it("prefers left/right when target is to the left", () => {
    expect(autoHandleSides({ x: 300, y: 0 }, { x: 0, y: 0 })).toEqual(["left", "right"]);
  });

  it("prefers bottom/top when target is below (greater dy than dx)", () => {
    expect(autoHandleSides({ x: 0, y: 0 }, { x: 50, y: 400 })).toEqual(["bottom", "top"]);
  });

  it("prefers top/bottom when target is above (greater dy than dx)", () => {
    expect(autoHandleSides({ x: 0, y: 400 }, { x: 50, y: 0 })).toEqual(["top", "bottom"]);
  });

  it("ties favor horizontal axis", () => {
    expect(autoHandleSides({ x: 0, y: 0 }, { x: 100, y: 100 })).toEqual(["right", "left"]);
  });
});

describe("toFlow — explicit and auto handle sides", () => {
  const lr: WorkflowGraph = {
    direction: "LR",
    nodes: [
      { id: "n1", type: "START", label: "S", position: { x: 0, y: 200 } },
      { id: "n2", type: "DECISION", label: "D", position: { x: 400, y: 200 } },
      { id: "n3", type: "ACTION", label: "A1", position: { x: 800, y: 0 } },
      { id: "n4", type: "HANDOFF", label: "H", position: { x: 800, y: 400 } },
    ],
    edges: [
      { id: "e1", from: "n1", to: "n2" },
      {
        id: "e2",
        from: "n2",
        to: "n3",
        sourceHandle: "top",
        targetHandle: "left",
      },
      { id: "e3", from: "n2", to: "n4" }, // auto: target is below
    ],
  };

  it("passes explicit sourceHandle/targetHandle through", () => {
    const { edges } = toFlow(lr);
    const e2 = edges.find((e) => e.id === "e2");
    expect(e2?.sourceHandle).toBe("top");
    expect(e2?.targetHandle).toBe("left");
  });

  it("infers horizontal sides when nodes are roughly level", () => {
    const { edges } = toFlow(lr);
    const e1 = edges.find((e) => e.id === "e1");
    expect(e1?.sourceHandle).toBe("right");
    expect(e1?.targetHandle).toBe("left");
  });

  it("infers vertical sides when target is below", () => {
    const { edges } = toFlow(lr);
    const e3 = edges.find((e) => e.id === "e3");
    // dx = 400, dy = 200 → still horizontal majority, so right/left
    expect(e3?.sourceHandle).toBe("right");
    expect(e3?.targetHandle).toBe("left");
  });

  it("attaches sourcePosition/targetPosition to edge.data", () => {
    const { edges } = toFlow(lr);
    const e2 = edges.find((e) => e.id === "e2");
    expect(e2?.data?.sourcePosition).toBe("top");
    expect(e2?.data?.targetPosition).toBe("left");
  });
});
