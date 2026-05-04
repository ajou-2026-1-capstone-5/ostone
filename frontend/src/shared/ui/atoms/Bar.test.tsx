import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it } from "vitest";
import { Bar } from "./Bar";

describe("Bar", () => {
  it("renders", () => {
    const { container } = render(<Bar value={0.5} />);
    expect(container.querySelector("div")).toBeInTheDocument();
  });

  it("renders as div element", () => {
    const { container } = render(<Bar value={0.5} />);
    expect(container.querySelector("div")?.tagName).toBe("DIV");
  });

  describe("value clamping", () => {
    it("clamps negative value to 0%", () => {
      const { container } = render(<Bar value={-0.5} />);
      const outer = container.querySelector("div");
      const inner = outer?.lastElementChild;
      const styleAttr = inner?.getAttribute("style");
      expect(styleAttr).toContain("width: 0%");
    });

    it("clamps value greater than 1 to 100%", () => {
      const { container } = render(<Bar value={1.5} />);
      const outer = container.querySelector("div");
      const inner = outer?.lastElementChild;
      const styleAttr = inner?.getAttribute("style");
      expect(styleAttr).toContain("width: 100%");
    });

    it("renders 0% for value=0", () => {
      const { container } = render(<Bar value={0} />);
      const outer = container.querySelector("div");
      const inner = outer?.lastElementChild;
      const styleAttr = inner?.getAttribute("style");
      expect(styleAttr).toContain("width: 0%");
    });

    it("renders 50% for value=0.5", () => {
      const { container } = render(<Bar value={0.5} />);
      const outer = container.querySelector("div");
      const inner = outer?.lastElementChild;
      const styleAttr = inner?.getAttribute("style");
      expect(styleAttr).toContain("width: 50%");
    });

    it("renders 100% for value=1", () => {
      const { container } = render(<Bar value={1} />);
      const outer = container.querySelector("div");
      const inner = outer?.lastElementChild;
      const styleAttr = inner?.getAttribute("style");
      expect(styleAttr).toContain("width: 100%");
    });

    it("renders 25% for value=0.25", () => {
      const { container } = render(<Bar value={0.25} />);
      const outer = container.querySelector("div");
      const inner = outer?.lastElementChild;
      const styleAttr = inner?.getAttribute("style");
      expect(styleAttr).toContain("width: 25%");
    });
  });

  describe("tone variations", () => {
    it('applies signal tone by default', () => {
      const { container } = render(<Bar value={0.5} tone="signal" />);
      const outer = container.querySelector("div");
      const inner = outer?.lastElementChild;
      expect(inner?.className).toContain("bg-[var(--signal)]");
    });

    it('applies warn tone', () => {
      const { container } = render(<Bar value={0.5} tone="warn" />);
      const outer = container.querySelector("div");
      const inner = outer?.lastElementChild;
      expect(inner?.className).toContain("bg-[var(--warn)]");
    });

    it('applies danger tone', () => {
      const { container } = render(<Bar value={0.5} tone="danger" />);
      const outer = container.querySelector("div");
      const inner = outer?.lastElementChild;
      expect(inner?.className).toContain("bg-[var(--danger)]");
    });

    it('applies mute tone', () => {
      const { container } = render(<Bar value={0.5} tone="mute" />);
      const outer = container.querySelector("div");
      const inner = outer?.lastElementChild;
      expect(inner?.className).toContain("bg-[var(--ink-2)]");
    });
  });

  it("applies custom height", () => {
    const { container } = render(<Bar value={0.5} height={20} />);
    const styleAttr = container.querySelector("div")?.getAttribute("style");
    expect(styleAttr).toContain("height: 20px");
  });

  it("applies default height of 8", () => {
    const { container } = render(<Bar value={0.5} />);
    const styleAttr = container.querySelector("div")?.getAttribute("style");
    expect(styleAttr).toContain("height: 8px");
  });

  it("applies custom className to outer container", () => {
    const { container } = render(<Bar value={0.5} className="custom-class" />);
    expect(container.querySelector("div")?.className).toContain("custom-class");
  });

  it("applies bg-[var(--line-2)] to outer container", () => {
    const { container } = render(<Bar value={0.5} />);
    expect(container.querySelector("div")?.className).toContain("bg-[var(--line-2)]");
  });

  it("applies w-full class to outer container", () => {
    const { container } = render(<Bar value={0.5} />);
    expect(container.querySelector("div")?.className).toContain("w-full");
  });

  it("applies overflow-hidden to outer container", () => {
    const { container } = render(<Bar value={0.5} />);
    expect(container.querySelector("div")?.className).toContain("overflow-hidden");
  });

  it("inner bar applies h-full class", () => {
    const { container } = render(<Bar value={0.5} />);
    const outer = container.querySelector("div");
    const inner = outer?.lastElementChild;
    expect(inner?.className).toContain("h-full");
  });

  it("inner bar applies rounded-[var(--r-1)] class", () => {
    const { container } = render(<Bar value={0.5} />);
    const outer = container.querySelector("div");
    const inner = outer?.lastElementChild;
    expect(inner?.className).toContain("rounded-[var(--r-1)]");
  });
});
