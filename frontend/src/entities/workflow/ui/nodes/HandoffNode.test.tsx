import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HandoffNode } from "./HandoffNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

const baseProps: Record<string, unknown> = {
  id: "test",
  type: "handoff",
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

describe("HandoffNode", () => {
  it("renders label from data", () => {
    render(<HandoffNode {...(baseProps as any)} data={{ label: "Handoff" }} />);
    expect(screen.getByText("Handoff")).toBeInTheDocument();
  });

  it("renders empty when label is not a string", () => {
    const { container } = render(<HandoffNode {...(baseProps as any)} data={{}} />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it("renders without crash when label is empty string", () => {
    const { container } = render(<HandoffNode {...(baseProps as any)} data={{ label: "" }} />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it("renders without crash when data is undefined", () => {
    const { container } = render(<HandoffNode {...(baseProps as any)} data={undefined} />);
    expect(container.firstElementChild).toBeTruthy();
  });
});
