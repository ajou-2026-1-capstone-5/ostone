import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Node } from "@xyflow/react";
import type { WorkflowGraph } from "../../model/types";
import { toFlow, convertFlowToWorkflowGraph } from "./graphConverter";

describe("graphConverter", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("toNodeType via convertFlowToWorkflowGraph", () => {
    it("maps undefined type to ACTION", () => {
      const nodes: Node[] = [
        { id: "n1", type: undefined as unknown as string, data: { label: "Test" } },
      ];
      const result = convertFlowToWorkflowGraph(nodes, []);
      expect(result.nodes[0].type).toBe("ACTION");
    });

    it("maps empty string type to ACTION", () => {
      const nodes: Node[] = [{ id: "n1", type: "", data: { label: "Test" } }];
      const result = convertFlowToWorkflowGraph(nodes, []);
      expect(result.nodes[0].type).toBe("ACTION");
    });

    it("maps whitespace string type to ACTION", () => {
      const nodes: Node[] = [{ id: "n1", type: "   ", data: { label: "Test" } }];
      const result = convertFlowToWorkflowGraph(nodes, []);
      expect(result.nodes[0].type).toBe("ACTION");
    });

    it("maps uppercase DECISION", () => {
      const nodes: Node[] = [
        { id: "n1", type: "DECISION", data: { label: "Test" } },
      ];
      const result = convertFlowToWorkflowGraph(nodes, []);
      expect(result.nodes[0].type).toBe("DECISION");
    });

    it("maps lowercase decision to DECISION", () => {
      const nodes: Node[] = [
        { id: "n1", type: "decision", data: { label: "Test" } },
      ];
      const result = convertFlowToWorkflowGraph(nodes, []);
      expect(result.nodes[0].type).toBe("DECISION");
    });

    it("logs warning for invalid type", () => {
      const nodes: Node[] = [
        { id: "n1", type: "INVALID", data: { label: "Test" } },
      ];
      convertFlowToWorkflowGraph(nodes, []);
      expect(console.warn).toHaveBeenCalledWith(
        '[graphConverter] unknown node type: "INVALID" — falling back to ACTION'
      );
    });
  });

  describe("toFlow", () => {
    it("maps ACTION node with policyRef", () => {
      const graph: WorkflowGraph = {
        direction: "TB",
        nodes: [
          {
            id: "n1",
            type: "ACTION",
            label: "Check Status",
            policyRef: "policy-1",
          },
        ],
        edges: [],
      };
      const { nodes } = toFlow(graph);
      expect(nodes[0]).toMatchObject({
        id: "n1",
        type: "action",
        data: { label: "Check Status", policyRef: "policy-1" },
      });
    });

    it("maps ACTION node without policyRef", () => {
      const graph: WorkflowGraph = {
        direction: "TB",
        nodes: [
          {
            id: "n1",
            type: "ACTION",
            label: "Notify",
          },
        ],
        edges: [],
      };
      const { nodes } = toFlow(graph);
      expect(nodes[0].data).toEqual({ label: "Notify" });
    });

    it("maps non-ACTION node without policyRef", () => {
      const graph: WorkflowGraph = {
        direction: "TB",
        nodes: [
          {
            id: "n1",
            type: "START",
            label: "Start",
          },
        ],
        edges: [],
      };
      const { nodes } = toFlow(graph);
      expect(nodes[0].data).toEqual({ label: "Start" });
    });

    it("sets type decision for edge from DECISION node", () => {
      const graph: WorkflowGraph = {
        direction: "TB",
        nodes: [
          { id: "n1", type: "DECISION", label: "Route" },
          { id: "n2", type: "ACTION", label: "Handle" },
        ],
        edges: [{ id: "e1", from: "n1", to: "n2", label: "yes" }],
      };
      const { edges } = toFlow(graph);
      expect(edges[0].type).toBe("decision");
    });

    it("sets type undefined for edge from non-DECISION node", () => {
      const graph: WorkflowGraph = {
        direction: "TB",
        nodes: [
          { id: "n1", type: "ACTION", label: "Act" },
          { id: "n2", type: "ACTION", label: "Next" },
        ],
        edges: [{ id: "e1", from: "n1", to: "n2" }],
      };
      const { edges } = toFlow(graph);
      expect(edges[0].type).toBeUndefined();
    });

    it("uses provided position", () => {
      const graph: WorkflowGraph = {
        direction: "TB",
        nodes: [
          { id: "n1", type: "ACTION", label: "Act", position: { x: 100, y: 200 } },
        ],
        edges: [],
      };
      const { nodes } = toFlow(graph);
      expect(nodes[0].position).toEqual({ x: 100, y: 200 });
    });

    it("computes position when not provided", () => {
      const graph: WorkflowGraph = {
        direction: "TB",
        nodes: [{ id: "n1", type: "ACTION", label: "Act1" }],
        edges: [],
      };
      const { nodes } = toFlow(graph);
      expect(nodes[0].position).toEqual({ x: 0, y: 0 });
    });

    it("computes positions for LR direction", () => {
      const graph: WorkflowGraph = {
        direction: "LR",
        nodes: [
          { id: "n1", type: "ACTION", label: "A" },
          { id: "n2", type: "ACTION", label: "B" },
          { id: "n3", type: "ACTION", label: "C" },
          { id: "n4", type: "ACTION", label: "D" },
          { id: "n5", type: "ACTION", label: "E" },
        ],
        edges: [],
      };
      const { nodes } = toFlow(graph);
      expect(nodes[0].position).toEqual({ x: 0, y: 0 });
      expect(nodes[1].position).toEqual({ x: 0, y: 120 });
      expect(nodes[2].position).toEqual({ x: 0, y: 240 });
      expect(nodes[3].position).toEqual({ x: 0, y: 360 });
      expect(nodes[4].position).toEqual({ x: 200, y: 0 });
    });

    it("computes positions for TB direction with multiple nodes", () => {
      const graph: WorkflowGraph = {
        direction: "TB",
        nodes: [
          { id: "n1", type: "ACTION", label: "A" },
          { id: "n2", type: "ACTION", label: "B" },
          { id: "n3", type: "ACTION", label: "C" },
          { id: "n4", type: "ACTION", label: "D" },
          { id: "n5", type: "ACTION", label: "E" },
        ],
        edges: [],
      };
      const { nodes } = toFlow(graph);
      expect(nodes[0].position).toEqual({ x: 0, y: 0 });
      expect(nodes[1].position).toEqual({ x: 200, y: 0 });
      expect(nodes[2].position).toEqual({ x: 400, y: 0 });
      expect(nodes[3].position).toEqual({ x: 600, y: 0 });
      expect(nodes[4].position).toEqual({ x: 0, y: 120 });
    });

    it("handles HANDOFF node type", () => {
      const graph: WorkflowGraph = {
        direction: "TB",
        nodes: [{ id: "n1", type: "HANDOFF", label: "Transfer" }],
        edges: [],
      };
      const { nodes } = toFlow(graph);
      expect(nodes[0]).toMatchObject({
        id: "n1",
        type: "handoff",
        data: { label: "Transfer" },
      });
    });

    it("handles TERMINAL node type", () => {
      const graph: WorkflowGraph = {
        direction: "TB",
        nodes: [{ id: "n1", type: "TERMINAL", label: "End" }],
        edges: [],
      };
      const { nodes } = toFlow(graph);
      expect(nodes[0]).toMatchObject({
        id: "n1",
        type: "terminal",
        data: { label: "End" },
      });
    });

    it("handles ANSWER node type", () => {
      const graph: WorkflowGraph = {
        direction: "TB",
        nodes: [{ id: "n1", type: "ANSWER", label: "Reply" }],
        edges: [],
      };
      const { nodes } = toFlow(graph);
      expect(nodes[0]).toMatchObject({
        id: "n1",
        type: "answer",
        data: { label: "Reply" },
      });
    });

    it("handles empty graph", () => {
      const graph: WorkflowGraph = {
        direction: "LR",
        nodes: [],
        edges: [],
      };
      const result = toFlow(graph);
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it("handles multiple edges from DECISION node", () => {
      const graph: WorkflowGraph = {
        direction: "TB",
        nodes: [
          { id: "n1", type: "DECISION", label: "Route" },
          { id: "n2", type: "ACTION", label: "Yes" },
          { id: "n3", type: "ACTION", label: "No" },
        ],
        edges: [
          { id: "e1", from: "n1", to: "n2", label: "yes" },
          { id: "e2", from: "n1", to: "n3", label: "no" },
        ],
      };
      const { edges } = toFlow(graph);
      expect(edges[0].type).toBe("decision");
      expect(edges[1].type).toBe("decision");
    });
  });

  describe("convertFlowToWorkflowGraph", () => {
    it("maps ACTION node with policyRef", () => {
      const nodes: Node[] = [
        {
          id: "n1",
          type: "ACTION",
          data: { label: "Check", policyRef: "policy-1" },
        },
      ];
      const result = convertFlowToWorkflowGraph(nodes, []);
      expect(result.nodes[0]).toMatchObject({
        id: "n1",
        type: "ACTION",
        label: "Check",
        policyRef: "policy-1",
      });
    });

    it("maps ACTION node without policyRef", () => {
      const nodes: Node[] = [
        {
          id: "n1",
          type: "ACTION",
          data: { label: "Notify" },
        },
      ];
      const result = convertFlowToWorkflowGraph(nodes, []);
      expect(result.nodes[0]).toMatchObject({
        id: "n1",
        type: "ACTION",
        label: "Notify",
      });
      expect(result.nodes[0].policyRef).toBeUndefined();
    });

    it("maps non-ACTION node without policyRef", () => {
      const nodes: Node[] = [
        {
          id: "n1",
          type: "START",
          data: { label: "Start" },
        },
      ];
      const result = convertFlowToWorkflowGraph(nodes, []);
      expect(result.nodes[0]).toMatchObject({
        id: "n1",
        type: "START",
        label: "Start",
      });
      expect("policyRef" in result.nodes[0]).toBe(false);
    });

    it("uses empty string for missing label", () => {
      const nodes: Node[] = [
        {
          id: "n1",
          type: "ACTION",
          data: {},
        },
      ];
      const result = convertFlowToWorkflowGraph(nodes, []);
      expect(result.nodes[0].label).toBe("");
    });

    it("maps ACTION node with empty string policyRef to undefined", () => {
      const nodes: Node[] = [
        {
          id: "n1",
          type: "ACTION",
          data: { label: "Check", policyRef: "" },
        },
      ];
      const result = convertFlowToWorkflowGraph(nodes, []);
      expect(result.nodes[0].policyRef).toBeUndefined();
    });

    it("maps edge with empty string label to undefined", () => {
      const nodes: Node[] = [
        { id: "n1", type: "ACTION", data: { label: "A" } },
        { id: "n2", type: "ACTION", data: { label: "B" } },
      ];
      const edges = [
        { id: "e1", source: "n1", target: "n2", label: "" },
      ];
      const result = convertFlowToWorkflowGraph(nodes, edges);
      expect(result.edges[0].label).toBeUndefined();
    });

    it("maps edge with non-string label to undefined", () => {
      const nodes: Node[] = [
        { id: "n1", type: "ACTION", data: { label: "A" } },
        { id: "n2", type: "ACTION", data: { label: "B" } },
      ];
      const edges = [
        { id: "e1", source: "n1", target: "n2", label: null as unknown as string },
      ];
      const result = convertFlowToWorkflowGraph(nodes, edges);
      expect(result.edges[0].label).toBeUndefined();
    });

    it("converts multiple nodes and edges together", () => {
      const nodes: Node[] = [
        { id: "n1", type: "START", data: { label: "Start" } },
        { id: "n2", type: "ACTION", data: { label: "Process", policyRef: "pol-1" } },
        { id: "n3", type: "DECISION", data: { label: "Check" } },
        { id: "n4", type: "TERMINAL", data: { label: "End" } },
      ];
      const edges = [
        { id: "e1", source: "n1", target: "n2", label: "next" },
        { id: "e2", source: "n2", target: "n3", label: "done" },
        { id: "e3", source: "n3", target: "n4", label: "fail" },
      ];
      const result = convertFlowToWorkflowGraph(nodes, edges);

      expect(result.nodes).toHaveLength(4);
      expect(result.nodes[0].type).toBe("START");
      expect(result.nodes[1].type).toBe("ACTION");
      expect(result.nodes[1].policyRef).toBe("pol-1");
      expect(result.nodes[2].type).toBe("DECISION");
      expect(result.nodes[3].type).toBe("TERMINAL");

      expect(result.edges).toHaveLength(3);
      expect(result.edges[0].label).toBe("next");
      expect(result.edges[2].label).toBe("fail");
    });
  });
});