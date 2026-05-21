import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TerminalNode } from "./TerminalNode";

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
  type: "terminal" as const,
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

describe("TerminalNode", () => {
  it("renders with label", () => {
    render(<TerminalNode {...defaultProps} data={{ label: "종료" }} />);
    expect(screen.getByText("종료")).toBeInTheDocument();
  });

  it("never applies runtime status class on the definition view", () => {
    render(<TerminalNode {...defaultProps} data={{ label: "종료", status: "COMPLETED" }} />);
    const container = screen.getByTestId("terminal-node");
    expect(container.className).not.toMatch(/status/);
  });
});
