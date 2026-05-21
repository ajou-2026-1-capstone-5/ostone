import { describe, expect, it } from "vitest";
import { enrichedLegacyGraph } from "./enrichedLegacy";

describe("enrichedLegacyGraph fixture", () => {
  it("has direction LR", () => {
    expect(enrichedLegacyGraph.direction).toBe("LR");
  });

  it("contains 6 nodes and 6 edges (start / identity-verified? / unlock / security_team / confirm / done)", () => {
    expect(enrichedLegacyGraph.nodes).toHaveLength(6);
    expect(enrichedLegacyGraph.edges).toHaveLength(6);
  });

  it("has exactly one START and one TERMINAL", () => {
    const starts = enrichedLegacyGraph.nodes.filter((n) => n.type === "START");
    const terminals = enrichedLegacyGraph.nodes.filter((n) => n.type === "TERMINAL");
    expect(starts).toHaveLength(1);
    expect(terminals).toHaveLength(1);
  });

  it("every node has explicit non-overlapping position", () => {
    const positions = enrichedLegacyGraph.nodes.map((n) => n.position!);
    positions.forEach((p) => {
      expect(typeof p.x).toBe("number");
      expect(typeof p.y).toBe("number");
    });
    // No two nodes share the same {x, y}
    const keys = new Set(positions.map((p) => `${p.x},${p.y}`));
    expect(keys.size).toBe(positions.length);
  });

  it("every node fills all optional enrichment fields", () => {
    enrichedLegacyGraph.nodes.forEach((n) => {
      expect(n.description?.length ?? 0).toBeGreaterThan(0);
      expect(typeof n.iconHint).toBe("string");
      expect(typeof n.accentColor).toBe("string");
      expect(typeof n.status).toBe("string");
      expect(n.meta && Object.keys(n.meta).length).toBeGreaterThan(0);
    });
  });

  it("ACTION nodes carry policyRef", () => {
    const actions = enrichedLegacyGraph.nodes.filter((n) => n.type === "ACTION");
    actions.forEach((n) => {
      expect(n.policyRef?.length ?? 0).toBeGreaterThan(0);
    });
  });

  it("decision branches use explicit yes/no handle sides for clean routing", () => {
    const yesEdge = enrichedLegacyGraph.edges.find((e) => e.label === "yes");
    const noEdge = enrichedLegacyGraph.edges.find((e) => e.label === "no");
    expect(yesEdge?.sourceHandle).toBe("top");
    expect(noEdge?.sourceHandle).toBe("bottom");
  });

  it("every edge references valid node ids", () => {
    const ids = new Set(enrichedLegacyGraph.nodes.map((n) => n.id));
    enrichedLegacyGraph.edges.forEach((e) => {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    });
  });

  it("edge ids are unique", () => {
    const ids = enrichedLegacyGraph.edges.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("graph is reachable from start to done", () => {
    const adjacency = new Map<string, string[]>();
    enrichedLegacyGraph.edges.forEach((e) => {
      const arr = adjacency.get(e.from) ?? [];
      arr.push(e.to);
      adjacency.set(e.from, arr);
    });
    const visited = new Set<string>();
    const queue = ["start"];
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const next of adjacency.get(id) ?? []) queue.push(next);
    }
    expect(visited.has("done")).toBe(true);
    expect(visited.has("unlock")).toBe(true);
    expect(visited.has("security_team")).toBe(true);
  });
});
