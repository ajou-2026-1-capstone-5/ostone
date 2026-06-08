import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { NodeProps } from "@xyflow/react";
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

function makeNodeProps(data: NodeProps["data"] | undefined): NodeProps {
  return { ...baseProps, data } as NodeProps;
}

describe("DecisionNode", () => {
  it("renders label from data", () => {
    render(<DecisionNode {...makeNodeProps({ label: "Decision" })} />);
    expect(screen.getByText("Decision")).toBeInTheDocument();
  });

  it("renders empty when label is not a string", () => {
    render(<DecisionNode {...makeNodeProps({})} />);
    expect(screen.getAllByTestId("handle")).toHaveLength(2);
  });

  it("renders without crash when label is empty string", () => {
    render(<DecisionNode {...makeNodeProps({ label: "" })} />);
    expect(screen.getAllByTestId("handle")).toHaveLength(2);
  });

  it("renders without crash when data is undefined", () => {
    render(<DecisionNode {...makeNodeProps(undefined)} />);
    expect(screen.getAllByTestId("handle")).toHaveLength(2);
  });
});
