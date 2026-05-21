import { describe, it, expect } from "vite-plus/test";
import { render } from "@testing-library/react";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders initial text", () => {
    render(<Avatar initial="AB" />);
    expect(document.querySelector("span")).toHaveTextContent("AB");
  });

  it("applies default size 28px", () => {
    render(<Avatar initial="A" />);
    const el = document.querySelector("span");
    expect(el!.style.width).toBe("28px");
    expect(el!.style.height).toBe("28px");
  });

  it("applies custom size", () => {
    render(<Avatar initial="A" size={40} />);
    const el = document.querySelector("span");
    expect(el!.style.width).toBe("40px");
    expect(el!.style.height).toBe("40px");
    expect(el!.style.fontSize).toBe("16px");
  });

  it("applies correct styles for each tone", () => {
    const tones = [
      { tone: "mute" as const, bg: "var(--paper-3)", color: "var(--ink-2)" },
      { tone: "signal" as const, bg: "var(--signal-bg)", color: "var(--signal-ink)" },
      { tone: "warn" as const, bg: "var(--warn-bg)", color: "var(--warn)" },
      { tone: "info" as const, bg: "var(--info-bg)", color: "var(--info)" },
    ];

    for (const { tone, bg, color } of tones) {
      const { container } = render(<Avatar initial="A" tone={tone} />);
      const el = container.querySelector("span");
      expect(el!.style.background).toBe(bg);
      expect(el!.style.color).toBe(color);
    }
  });
});
