import { describe, expect, it } from "vitest";
import { enrichedDemoGraph } from "./enrichedDemo";

describe("enrichedDemoGraph fixture", () => {
  it("has LR direction", () => {
    expect(enrichedDemoGraph.direction).toBe("LR");
  });

  it("contains 8 nodes and 7 edges", () => {
    expect(enrichedDemoGraph.nodes).toHaveLength(8);
    expect(enrichedDemoGraph.edges).toHaveLength(7);
  });

  it("includes every node kind at least once", () => {
    const kinds = new Set(enrichedDemoGraph.nodes.map((n) => n.type));
    ["START", "ACTION", "DECISION", "ANSWER", "HANDOFF", "TERMINAL"].forEach((k) => {
      expect(kinds.has(k as never)).toBe(true);
    });
  });

  it("every node has a non-empty label", () => {
    enrichedDemoGraph.nodes.forEach((n) => {
      expect(n.label.length).toBeGreaterThan(0);
    });
  });

  it("every node has description (rich fixture invariant)", () => {
    enrichedDemoGraph.nodes.forEach((n) => {
      expect(n.description).toBeDefined();
      expect(n.description!.length).toBeGreaterThan(0);
    });
  });

  it("every node has iconHint", () => {
    enrichedDemoGraph.nodes.forEach((n) => {
      expect(typeof n.iconHint).toBe("string");
    });
  });

  it("every node has accentColor", () => {
    const allowed = new Set(["violet", "indigo", "amber", "sky", "rose", "zinc"]);
    enrichedDemoGraph.nodes.forEach((n) => {
      expect(n.accentColor).toBeDefined();
      expect(allowed.has(n.accentColor!)).toBe(true);
    });
  });

  it("every node has a status from the allowed set", () => {
    const allowed = new Set(["IDLE", "ACTIVE", "COMPLETED", "FAILED"]);
    enrichedDemoGraph.nodes.forEach((n) => {
      expect(n.status).toBeDefined();
      expect(allowed.has(n.status!)).toBe(true);
    });
  });

  it("every node has explicit position", () => {
    enrichedDemoGraph.nodes.forEach((n) => {
      expect(n.position).toBeDefined();
      expect(typeof n.position!.x).toBe("number");
      expect(typeof n.position!.y).toBe("number");
    });
  });

  it("every node has meta object with at least one key", () => {
    enrichedDemoGraph.nodes.forEach((n) => {
      expect(n.meta).toBeDefined();
      expect(Object.keys(n.meta!).length).toBeGreaterThan(0);
    });
  });

  it("ACTION nodes carry policyRef", () => {
    const actions = enrichedDemoGraph.nodes.filter((n) => n.type === "ACTION");
    expect(actions.length).toBeGreaterThan(0);
    actions.forEach((n) => {
      expect(n.policyRef).toBeDefined();
      expect(n.policyRef!.length).toBeGreaterThan(0);
    });
  });

  it("every edge references valid node ids", () => {
    const ids = new Set(enrichedDemoGraph.nodes.map((n) => n.id));
    enrichedDemoGraph.edges.forEach((e) => {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    });
  });

  it("edge ids are unique", () => {
    const ids = enrichedDemoGraph.edges.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("node ids are unique", () => {
    const ids = enrichedDemoGraph.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains both yes-toned and no-toned decision edges (for visual variety)", () => {
    const labels = enrichedDemoGraph.edges
      .map((e) => e.label)
      .filter((l): l is string => typeof l === "string");
    expect(labels.some((l) => /일치/.test(l))).toBe(true);
    expect(labels.some((l) => /일치하지\s*않/.test(l))).toBe(true);
  });
});
