import { describe, it, expect } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { Pill } from "./Pill";

describe("Pill", () => {
  it("renders children text", () => {
    const { getByText } = render(<Pill tone="signal">Active</Pill>);
    expect(getByText("Active")).toBeInTheDocument();
  });

  it("applies correct styles for each tone", () => {
    const tones = [
      { tone: "signal" as const, bg: "var(--signal-bg)", color: "var(--signal-ink)" },
      { tone: "warn" as const, bg: "var(--warn-bg)", color: "var(--warn)" },
      { tone: "danger" as const, bg: "var(--danger-bg)", color: "var(--danger)" },
      { tone: "info" as const, bg: "var(--info-bg)", color: "var(--info)" },
      { tone: "mute" as const, bg: "var(--paper-2)", color: "var(--ink-3)" },
      { tone: "ink" as const, bg: "var(--ink)", color: "var(--paper)" },
    ];

    for (const { tone, bg, color } of tones) {
      const { getByText } = render(<Pill tone={tone}>{tone}</Pill>);
      expect(getByText(tone)).toHaveStyle({ background: bg, color });
    }
  });

  it("falls back to mute for invalid tone", () => {
    const { getByText } = render(<Pill tone={"invalid" as never}>X</Pill>);
    expect(getByText("X")).toHaveStyle({
      background: "var(--paper-2)",
      color: "var(--ink-3)",
    });
  });

  it("accepts optional className", () => {
    render(
      <Pill tone="signal" className="extra">
        X
      </Pill>,
    );
    expect(screen.getByText("X")).toHaveClass("extra");
  });
});
