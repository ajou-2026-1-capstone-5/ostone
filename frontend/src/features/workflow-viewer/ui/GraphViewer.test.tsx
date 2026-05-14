import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { WorkflowGraph } from "@/entities/workflow";
import { GraphViewer } from "./GraphViewer";

const mockToFlow = vi.hoisted(() =>
  vi.fn(() => ({
    nodes: [
      {
        id: "n1",
        type: "start",
        position: { x: 0, y: 0 },
        data: { label: "Start" },
      },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2" }],
  })),
);

vi.mock("@/entities/workflow/lib/graphConverter", () => ({
  toFlow: mockToFlow,
}));

vi.mock("@xyflow/react", () => ({
  ReactFlow: () => <div data-testid="reactflow" />,
  Background: () => null,
  Controls: () => null,
  MarkerType: { ArrowClosed: "arrowclosed" },
}));

const mockGraph: WorkflowGraph = {
  nodes: [{ id: "n1", type: "start", label: "Start", x: 0, y: 0 }],
  edges: [{ id: "e1", from: "n1", to: "n2" }],
};

describe("GraphViewer", () => {
  it("renders ReactFlow canvas", () => {
    render(<GraphViewer graph={mockGraph} />);
    const flow = screen.getByTestId("reactflow");
    expect(flow).toBeInTheDocument();
  });

  it("passes graph data to toFlow converter", () => {
    render(<GraphViewer graph={mockGraph} />);
    expect(mockToFlow).toHaveBeenCalledWith(mockGraph);
  });

  it("renders with minimal props", () => {
    const minimalGraph: WorkflowGraph = {
      nodes: [],
      edges: [],
    };
    render(<GraphViewer graph={minimalGraph} />);
    const flow = screen.getByTestId("reactflow");
    expect(flow).toBeInTheDocument();
  });
});
