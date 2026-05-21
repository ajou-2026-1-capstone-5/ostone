import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DecisionNode } from "./DecisionNode";

vi.mock("@xyflow/react", () => ({
  Handle: ({ type, id }: { type: string; id: string }) => (
    <div data-testid={`handle-${type}-${id}`} />
  ),
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
  // Run the selector against an empty edges store so the hook produces an
  // empty {sources, targets} object — "no edges yet" is the right baseline
  // for unit tests of a single node.
  useStore: (selector: (s: { edges: never[] }) => unknown) => selector({ edges: [] }),
}));

const defaultProps = {
  id: "test",
  type: "decision" as const,
  selected: false,
  dragging: false,
  zIndex: 0,
  selectable: true,
  deletable: false,
  draggable: true,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
};

describe("DecisionNode", () => {
  it("renders with label", () => {
    render(<DecisionNode {...defaultProps} data={{ label: "분기점" }} />);
    expect(screen.getByText("분기점")).toBeInTheDocument();
  });

  it("never applies runtime status class on the definition view", () => {
    render(<DecisionNode {...defaultProps} data={{ label: "분기점", status: "FAILED" }} />);
    const container = screen.getByTestId("decision-node");
    expect(container.className).not.toMatch(/status/);
  });
});
