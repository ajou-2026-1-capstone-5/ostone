import { describe, it, expect } from "vite-plus/test";
import { render } from "@testing-library/react";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders initial text", () => {
    const { getByText } = render(<Avatar initial="AB" />);
    expect(getByText("AB")).toBeInTheDocument();
  });

  it("applies default size 28px", () => {
    const { getByText } = render(<Avatar initial="A" />);
    const avatar = getByText("A");
    expect(avatar).toHaveStyle({ width: "28px", height: "28px" });
  });

  it("applies custom size", () => {
    const { getByText } = render(<Avatar initial="A" size={40} />);
    expect(getByText("A")).toHaveStyle({
      width: "40px",
      height: "40px",
      fontSize: "16px",
    });
  });

  it("applies correct styles for each tone", () => {
    const tones = [
      { tone: "mute" as const, bg: "var(--paper-3)", color: "var(--ink-2)" },
      { tone: "signal" as const, bg: "var(--signal-bg)", color: "var(--signal-ink)" },
      { tone: "warn" as const, bg: "var(--warn-bg)", color: "var(--warn)" },
      { tone: "info" as const, bg: "var(--info-bg)", color: "var(--info)" },
    ];

    for (const { tone, bg, color } of tones) {
      const { getByText } = render(<Avatar initial={tone} tone={tone} />);
      expect(getByText(tone)).toHaveStyle({ background: bg, color });
    }
  });
});
