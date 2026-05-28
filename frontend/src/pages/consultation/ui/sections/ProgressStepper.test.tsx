import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressStepper, type ProgressStepperStep } from "./ProgressStepper";

const STEPS: ProgressStepperStep[] = [
  { label: "접수", value: "05-03", state: "done" },
  { label: "확인 중", value: "05-04", state: "done" },
  { label: "처리 중", value: "진행중", state: "active" },
  { label: "완료", value: "예정", state: "todo" },
];

describe("ProgressStepper", () => {
  it("renders one listitem per step", () => {
    render(<ProgressStepper steps={STEPS} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(STEPS.length);
  });

  it("marks the active step with aria-current='step'", () => {
    render(<ProgressStepper steps={STEPS} />);

    const active = screen.getAllByRole("listitem").find((node) => node.dataset.state === "active");
    expect(active).toBeDefined();
    expect(active).toHaveAttribute("aria-current", "step");
  });

  it("exposes data-state matching each step state", () => {
    render(<ProgressStepper steps={STEPS} />);

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("data-state", "done");
    expect(items[1]).toHaveAttribute("data-state", "done");
    expect(items[2]).toHaveAttribute("data-state", "active");
    expect(items[3]).toHaveAttribute("data-state", "todo");
  });

  it("renders optional step value when provided", () => {
    render(<ProgressStepper steps={STEPS} />);

    expect(screen.getByText("05-03")).toBeInTheDocument();
    expect(screen.getByText("진행중")).toBeInTheDocument();
  });
});
