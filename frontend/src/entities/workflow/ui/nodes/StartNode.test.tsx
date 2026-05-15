import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StartNode } from "./StartNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("StartNode", () => {
  it("renders label from data", () => {
    render(<StartNode id="test" data={{ label: "Start" }} />);
    expect(screen.getByText("Start")).toBeInTheDocument();
  });

  it("renders empty when label is not a string", () => {
    const { container } = render(<StartNode id="test" data={{}} />);
    expect(container.firstElementChild).toBeTruthy();
  });
});