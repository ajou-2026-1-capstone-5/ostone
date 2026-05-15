import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HandoffNode } from "./HandoffNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("HandoffNode", () => {
  it("renders label from data", () => {
    render(<HandoffNode id="test" data={{ label: "Handoff" }} />);
    expect(screen.getByText("Handoff")).toBeInTheDocument();
  });

  it("renders empty when label is not a string", () => {
    const { container } = render(<HandoffNode id="test" data={{}} />);
    expect(container.firstElementChild).toBeTruthy();
  });
});