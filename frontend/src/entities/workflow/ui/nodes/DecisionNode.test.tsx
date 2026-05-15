import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DecisionNode } from "./DecisionNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

const baseProps: Record<string, unknown> = {
  id: "test",
  type: "decision",
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

describe("DecisionNode", () => {
  it("renders label from data", () => {
    render(<DecisionNode {...(baseProps as any)} data={{ label: "Decision" }} />);
    expect(screen.getByText("Decision")).toBeInTheDocument();
  });

  it("renders empty when label is not a string", () => {
    const { container } = render(<DecisionNode {...(baseProps as any)} data={{}} />);
    expect(container.firstElementChild).toBeTruthy();
  });
});