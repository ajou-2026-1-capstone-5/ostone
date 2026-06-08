import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { NodeProps } from "@xyflow/react";
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

function makeNodeProps(data: NodeProps["data"] | undefined): NodeProps {
  return { ...baseProps, data } as NodeProps;
}

describe("ActionNode", () => {
  it("renders label from data", () => {
    render(<ActionNode {...makeNodeProps({ label: "Test State" })} />);
    expect(screen.getByText("Test State")).toBeInTheDocument();
  });

  it("applies selected style when data.selected is true", () => {
    render(<ActionNode {...makeNodeProps({ label: "Test", selected: true })} />);
    expect(screen.getByText("Test").parentElement).toHaveAttribute(
      "class",
      expect.stringContaining("selected"),
    );
  });

  it("does not apply selected style when data.selected is falsy", () => {
    render(<ActionNode {...makeNodeProps({ label: "Test" })} />);
    expect(screen.getByText("Test").parentElement).toHaveAttribute(
      "class",
      expect.not.stringContaining("selected"),
    );
  });

  it("applies current style when data.current is true", () => {
    render(<ActionNode {...makeNodeProps({ label: "Test", current: true })} />);
    expect(screen.getByText("Test").parentElement).toHaveAttribute(
      "class",
      expect.stringContaining("current"),
    );
  });

  it("does not apply current style when data.current is false", () => {
    render(<ActionNode {...makeNodeProps({ label: "Test", current: false })} />);
    expect(screen.getByText("Test").parentElement).toHaveAttribute(
      "class",
      expect.not.stringContaining("current"),
    );
  });
});
