import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TerminalNode } from "./TerminalNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

const baseProps: Record<string, unknown> = {
  id: "test",
  type: "terminal",
  selected: false,
  dragging: false,
  zIndex: 0,
  selectable: true,
  deletable: false,
  draggable: true,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  height: 0,
  width: 0,
  sourcePosition: "left",
  targetPosition: "right",
};

describe("TerminalNode", () => {
  it("renders label from data", () => {
    render(<TerminalNode {...(baseProps as any)} data={{ label: "Terminal" }} />);
    expect(screen.getByText("Terminal")).toBeInTheDocument();
  });

  it("renders empty when label is not a string", () => {
    const { container } = render(<TerminalNode {...(baseProps as any)} data={{}} />);
    expect(container.firstElementChild).toBeTruthy();
  });
});