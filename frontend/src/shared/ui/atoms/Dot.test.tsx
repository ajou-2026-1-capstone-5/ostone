import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it } from "vitest";
import { Dot } from "./Dot";

describe("Dot", () => {
  it("renders", () => {
    const { container } = render(<Dot tone="signal" />);
    const el = container.querySelector("span");
    expect(el).toBeInTheDocument();
  });

  it("renders as span element", () => {
    const { container } = render(<Dot tone="warn" />);
    const el = container.querySelector("span");
    expect(el?.tagName).toBe("SPAN");
  });

  describe("tone variations", () => {
    it('applies signal tone', () => {
      const { container } = render(<Dot tone="signal" />);
      expect(container.querySelector("span")?.className).toContain("bg-[var(--signal)]");
    });

    it('applies warn tone', () => {
      const { container } = render(<Dot tone="warn" />);
      expect(container.querySelector("span")?.className).toContain("bg-[var(--warn)]");
    });

    it('applies danger tone', () => {
      const { container } = render(<Dot tone="danger" />);
      expect(container.querySelector("span")?.className).toContain("bg-[var(--danger)]");
    });

    it('applies info tone', () => {
      const { container } = render(<Dot tone="info" />);
      expect(container.querySelector("span")?.className).toContain("bg-[var(--info)]");
    });

    it('applies mute tone', () => {
      const { container } = render(<Dot tone="mute" />);
      expect(container.querySelector("span")?.className).toContain("bg-[var(--ink-4)]");
    });
  });

  it("applies default size of 6", () => {
    const { container } = render(<Dot tone="signal" />);
    const el = container.querySelector("span");
    expect(el).toHaveStyle({ width: "6px", height: "6px" });
  });

  it("applies custom size", () => {
    const { container } = render(<Dot tone="warn" size={12} />);
    const el = container.querySelector("span");
    expect(el).toHaveStyle({ width: "12px", height: "12px" });
  });

  it("applies rounded-full class", () => {
    const { container } = render(<Dot tone="signal" />);
    expect(container.querySelector("span")?.className).toContain("rounded-full");
  });

  it("applies flex-shrink-0 class", () => {
    const { container } = render(<Dot tone="signal" />);
    expect(container.querySelector("span")?.className).toContain("flex-shrink-0");
  });
});
