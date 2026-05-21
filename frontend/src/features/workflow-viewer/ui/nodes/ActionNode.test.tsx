import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionNode } from "./ActionNode";

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
  type: "action" as const,
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

describe("ActionNode", () => {
  it("renders with label", () => {
    render(<ActionNode {...defaultProps} data={{ label: "액션" }} />);
    expect(screen.getByText("액션")).toBeInTheDocument();
  });

  it("renders with policyRef text when provided", () => {
    render(<ActionNode {...defaultProps} data={{ label: "액션", policyRef: "POL-001" }} />);
    expect(screen.getByText("POL-001")).toBeInTheDocument();
  });

  it("does NOT render policyRef div when not provided", () => {
    render(<ActionNode {...defaultProps} data={{ label: "액션" }} />);
    expect(screen.getByText("액션")).toBeInTheDocument();
    expect(screen.queryByText("POL-001")).not.toBeInTheDocument();
  });

  it("never applies a runtime status class on the definition view", () => {
    render(<ActionNode {...defaultProps} data={{ label: "액션", status: "COMPLETED" }} />);
    const container = screen.getByTestId("action-node");
    expect(container.className).not.toMatch(/status/);
  });
});
