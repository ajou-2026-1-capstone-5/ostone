import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StartNode } from "./StartNode";

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
  type: "start" as const,
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

describe("StartNode", () => {
  it("renders with label text", () => {
    render(<StartNode {...defaultProps} data={{ label: "시작" }} />);
    expect(screen.getByText("시작")).toBeInTheDocument();
  });

  it("never applies a runtime status class on the definition view", () => {
    render(<StartNode {...defaultProps} data={{ label: "시작", status: "COMPLETED" }} />);
    const container = screen.getByTestId("start-node");
    expect(container.className).not.toMatch(/status/);
  });

  it("shows empty label when data.label is undefined", () => {
    render(<StartNode {...defaultProps} data={{}} />);
    const label = screen.getByTestId("start-node-label");
    expect(label).toBeInTheDocument();
    expect(label.textContent).toBe("");
  });

  it("renders description when present", () => {
    render(<StartNode {...defaultProps} data={{ label: "시작", description: "트리거" }} />);
    expect(screen.getByText("트리거")).toBeInTheDocument();
  });

  it("renders badges when present", () => {
    render(<StartNode {...defaultProps} data={{ label: "시작", badges: ["b1", "b2"] }} />);
    expect(screen.getByText("b1")).toBeInTheDocument();
    expect(screen.getByText("b2")).toBeInTheDocument();
  });
});
