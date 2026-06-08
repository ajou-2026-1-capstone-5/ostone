import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { NodeProps } from "@xyflow/react";
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

function makeNodeProps(data: NodeProps["data"] | undefined): NodeProps {
  return { ...baseProps, data } as NodeProps;
}

describe("TerminalNode", () => {
  it("renders label from data", () => {
    render(<TerminalNode {...makeNodeProps({ label: "Terminal" })} />);
    expect(screen.getByText("Terminal")).toBeInTheDocument();
  });

  it("renders empty when label is not a string", () => {
    render(<TerminalNode {...makeNodeProps({})} />);
    expect(screen.getAllByTestId("handle")).toHaveLength(1);
  });

  it("renders without crash when label is empty string", () => {
    render(<TerminalNode {...makeNodeProps({ label: "" })} />);
    expect(screen.getAllByTestId("handle")).toHaveLength(1);
  });

  it("renders without crash when data is undefined", () => {
    render(<TerminalNode {...makeNodeProps(undefined)} />);
    expect(screen.getAllByTestId("handle")).toHaveLength(1);
  });
});
