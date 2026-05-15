import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnswerNode } from "./AnswerNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("AnswerNode", () => {
  it("renders label from data", () => {
    render(<AnswerNode id="test" data={{ label: "Test" }} />);
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("renders empty when label is not a string", () => {
    const { container } = render(<AnswerNode id="test" data={{}} />);
    expect(container.firstElementChild).toBeTruthy();
  });
});