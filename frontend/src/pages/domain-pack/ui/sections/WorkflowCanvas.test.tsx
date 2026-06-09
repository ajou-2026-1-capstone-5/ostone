import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { DEFAULT_NODES, DEFAULT_EDGES } from "./workflowCanvasData";

describe("WorkflowCanvas", () => {
  it("renders 8 data-node-kind elements given DEFAULT_NODES", () => {
    const { container } = render(<WorkflowCanvas nodes={DEFAULT_NODES} edges={DEFAULT_EDGES} />);
    const nodeElements = container.querySelectorAll("[data-node-kind]");
    expect(nodeElements).toHaveLength(8);
  });

  it("renders at least 9 edge paths", () => {
    const { container } = render(<WorkflowCanvas nodes={DEFAULT_NODES} edges={DEFAULT_EDGES} />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(9);
  });

  it("empty nodes=[] edges=[] renders SVG without error", () => {
    const { container } = render(<WorkflowCanvas nodes={[]} edges={[]} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 100 60");
  });

  it("selected node has data-selected-halo attribute", () => {
    const { container } = render(<WorkflowCanvas nodes={DEFAULT_NODES} edges={DEFAULT_EDGES} />);
    const selectedNode = container.querySelector("[data-selected-halo]");
    expect(selectedNode).toBeInTheDocument();
    expect(selectedNode?.getAttribute("data-node-kind")).toBe("decision");
  });
});
