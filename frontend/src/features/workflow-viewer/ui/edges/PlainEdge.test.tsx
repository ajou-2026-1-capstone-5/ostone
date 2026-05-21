import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlainEdge } from "./PlainEdge";

vi.mock("@xyflow/react", () => ({
  BaseEdge: ({ path }: { path: string }) => <path data-testid="base-edge" d={path} />,
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  getBezierPath: () => ["M0,0 C50,0 50,100 100,100", 50, 50],
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

const defaultProps = {
  id: "test-edge",
  source: "source-node",
  target: "target-node",
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: "right" as unknown as never,
  targetPosition: "left" as unknown as never,
  selected: false,
  sourceHandleId: null,
  targetHandleId: null,
  markerEnd: undefined,
  type: "plain" as const,
  zIndex: 0,
  label: undefined,
};

describe("PlainEdge", () => {
  it("renders edge path (BaseEdge renders)", () => {
    const { container } = render(<PlainEdge {...defaultProps} />);
    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();
  });

  it("renders label text when provided", () => {
    render(<PlainEdge {...defaultProps} label="에지 레이블" />);
    expect(screen.getByText("에지 레이블")).toBeInTheDocument();
  });

  it("does NOT render label text when label is undefined", () => {
    render(<PlainEdge {...defaultProps} />);
    expect(screen.queryByText("에지 레이블")).not.toBeInTheDocument();
  });
});
