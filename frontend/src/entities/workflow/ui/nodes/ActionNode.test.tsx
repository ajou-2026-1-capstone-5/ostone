import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionNode } from "./ActionNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

const baseProps: Record<string, unknown> = {
  id: "test",
  height: 0,
  width: 0,
  sourcePosition: "left",
  targetPosition: "right",
  dragHandle: undefined,
  parentId: undefined,
  selected: false,
  dragging: false,
  zIndex: 0,
  selectable: true,
  deletable: false,
  draggable: true,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  type: "action",
};

describe("ActionNode", () => {
  it("renders label from data", () => {
    render(<ActionNode {...(baseProps as any)} data={{ label: "Test State" }} />);
    expect(screen.getByText("Test State")).toBeInTheDocument();
  });

  it("applies selected style when data.selected is true", () => {
    const { container } = render(
      <ActionNode {...(baseProps as any)} data={{ label: "Test", selected: true }} />,
    );
    const nodeDiv = container.querySelector('[class*="action"]');
    expect(nodeDiv?.className).toContain("selected");
  });

  it("does not apply selected style when data.selected is falsy", () => {
    const { container } = render(
      <ActionNode {...(baseProps as any)} data={{ label: "Test" }} />,
    );
    const nodeDiv = container.firstElementChild;
    expect(nodeDiv?.className).not.toContain("selected");
  });

  it("applies current style when data.current is true", () => {
    const { container } = render(
      <ActionNode {...(baseProps as any)} data={{ label: "Test", current: true }} />,
    );
    const nodeDiv = container.firstElementChild;
    expect(nodeDiv?.className).toContain("current");
  });

  it("does not apply current style when data.current is false", () => {
    const { container } = render(
      <ActionNode {...(baseProps as any)} data={{ label: "Test", current: false }} />,
    );
    const nodeDiv = container.firstElementChild;
    expect(nodeDiv?.className).not.toContain("current");
  });
});
