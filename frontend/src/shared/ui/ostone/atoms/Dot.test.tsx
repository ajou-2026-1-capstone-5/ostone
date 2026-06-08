import { describe, it, expect } from "vite-plus/test";
import { render } from "@testing-library/react";
import { Dot } from "./Dot";

describe("Dot", () => {
  it("renders with default size 6px", () => {
    const { container } = render(<Dot tone="signal" />);
    const dot = container.firstElementChild;
    expect(dot).toBeInstanceOf(HTMLSpanElement);
    expect(dot).toHaveStyle({ width: "6px", height: "6px" });
  });

  it("renders with custom size", () => {
    const { container } = render(<Dot tone="signal" size={10} />);
    expect(container.firstElementChild).toHaveStyle({ width: "10px", height: "10px" });
  });

  it("applies correct background for each tone", () => {
    const tones = [
      { tone: "signal" as const, color: "var(--signal)" },
      { tone: "warn" as const, color: "var(--warn)" },
      { tone: "danger" as const, color: "var(--danger)" },
      { tone: "info" as const, color: "var(--info)" },
      { tone: "mute" as const, color: "var(--ink-4)" },
    ];

    for (const { tone, color } of tones) {
      const { container } = render(<Dot tone={tone} />);
      expect(container.firstElementChild).toHaveStyle({ background: color });
    }
  });
});
