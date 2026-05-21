import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HandoffNode } from "./HandoffNode";

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
  type: "handoff" as const,
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

describe("HandoffNode", () => {
  it("renders with label", () => {
    render(<HandoffNode {...defaultProps} data={{ label: "전달" }} />);
    expect(screen.getByText("전달")).toBeInTheDocument();
  });

  it("never applies runtime status class on the definition view", () => {
    render(<HandoffNode {...defaultProps} data={{ label: "전달", status: "ACTIVE" }} />);
    const container = screen.getByTestId("handoff-node");
    expect(container.className).not.toMatch(/status/);
  });
});
