import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DecisionNode } from "./DecisionNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("DecisionNode", () => {
  it("renders label from data", () => {
    render(<DecisionNode id="test" data={{ label: "Decision" }} />);
    expect(screen.getByText("Decision")).toBeInTheDocument();
  });

  it("renders empty when label is not a string", () => {
    const { container } = render(<DecisionNode id="test" data={{}} />);
    expect(container.firstElementChild).toBeTruthy();
  });
});