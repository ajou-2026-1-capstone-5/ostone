import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TerminalNode } from "./TerminalNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("TerminalNode", () => {
  it("renders label from data", () => {
    render(<TerminalNode id="test" data={{ label: "Terminal" }} />);
    expect(screen.getByText("Terminal")).toBeInTheDocument();
  });

  it("renders empty when label is not a string", () => {
    const { container } = render(<TerminalNode id="test" data={{}} />);
    expect(container.firstElementChild).toBeTruthy();
  });
});