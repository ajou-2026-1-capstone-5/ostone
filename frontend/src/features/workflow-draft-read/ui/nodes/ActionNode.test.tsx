import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionNode } from "./ActionNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("ActionNode", () => {
  it("renders label from data", () => {
    render(<ActionNode id="test" data={{ label: "Test State" }} />);
    expect(screen.getByText("Test State")).toBeInTheDocument();
  });

  it("applies selected style when data.selected is true", () => {
    const { container } = render(
      <ActionNode id="test" data={{ label: "Test", selected: true }} />,
    );
    const nodeDiv = container.querySelector('[class*="action"]');
    expect(nodeDiv?.className).toContain("selected");
  });

  it("does not apply selected style when data.selected is falsy", () => {
    const { container } = render(
      <ActionNode id="test" data={{ label: "Test" }} />,
    );
    const nodeDiv = container.querySelector('[class*="action"]');
    expect(nodeDiv?.className).not.toContain("selected");
  });
});
