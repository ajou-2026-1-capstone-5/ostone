import { describe, it, expect } from "vite-plus/test";
import { render } from "@testing-library/react";
import { Pill } from "./Pill";

describe("Pill", () => {
  it("renders children text", () => {
    render(<Pill tone="signal">Active</Pill>);
    expect(document.querySelector("span")).toHaveTextContent("Active");
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
      const { container } = render(<Pill tone={tone}>{tone}</Pill>);
      const el = container.querySelector("span");
      expect(el!.style.background).toBe(bg);
      expect(el!.style.color).toBe(color);
    }
  });

  it("falls back to mute for invalid tone", () => {
    const { container } = render(<Pill tone={"invalid" as never}>X</Pill>);
    const el = container.querySelector("span");
    expect(el!.style.background).toBe("var(--paper-2)");
    expect(el!.style.color).toBe("var(--ink-3)");
  });

  it("accepts optional className", () => {
    render(
      <Pill tone="signal" className="extra">
        X
      </Pill>,
    );
    const el = document.querySelector("span");
    expect(el!.classList.contains("extra")).toBe(true);
  });
});
