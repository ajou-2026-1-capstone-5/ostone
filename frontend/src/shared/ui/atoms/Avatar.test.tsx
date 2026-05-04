import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders", () => {
    const { container } = render(<Avatar name="John Doe" />);
    expect(container.textContent).toBe("JD");
  });

  it("renders as span element", () => {
    const { container } = render(<Avatar name="Alice Bob" />);
    expect(container.querySelector("span")?.tagName).toBe("SPAN");
  });

  describe("getInitial logic", () => {
    it("returns first char of email when name contains @", () => {
      const { container } = render(<Avatar name="user@example.com" />);
      expect(container.textContent).toBe("U");
    });

    it("returns first letter of email without @ prefix", () => {
      const { container } = render(<Avatar name="@test.com" />);
      expect(container.textContent).toBe("@");
    });

    it("returns first letter of single-word Korean name", () => {
      const { container } = render(<Avatar name="강희원" />);
      expect(container.textContent).toBe("강");
    });

    it("returns first letters of two-word English name", () => {
      const { container } = render(<Avatar name="John Doe" />);
      expect(container.textContent).toBe("JD");
    });

    it("returns first letter for single word name", () => {
      const { container } = render(<Avatar name="Alice" />);
      expect(container.textContent).toBe("A");
    });

    it("returns ? for empty name", () => {
      const { container } = render(<Avatar name="" />);
      expect(container.textContent).toBe("?");
    });

    it("handles multi-space separated name (takes first two non-empty words)", () => {
      const { container } = render(<Avatar name="John  Doe" />);
      expect(container.textContent).toBe("JD");
    });

    it("handles name with extra whitespace", () => {
      const { container } = render(<Avatar name="  Jane   Smith  " />);
      expect(container.textContent).toBe("JS");
    });

    it("uppercases the initials", () => {
      const { container } = render(<Avatar name="alice bob" />);
      expect(container.textContent).toBe("AB");
    });
  });

  describe("size variations", () => {
    it("applies w-6 h-6 text-[10px] for size=24 (default)", () => {
      const { container } = render(<Avatar name="Test User" size={24} />);
      expect(container.querySelector("span")?.className).toContain("w-6");
      expect(container.querySelector("span")?.className).toContain("h-6");
      expect(container.querySelector("span")?.className).toContain("text-[10px]");
    });

    it("applies w-8 h-8 text-xs for size=32", () => {
      const { container } = render(<Avatar name="Test User" size={32} />);
      expect(container.querySelector("span")?.className).toContain("w-8");
      expect(container.querySelector("span")?.className).toContain("h-8");
      expect(container.querySelector("span")?.className).toContain("text-xs");
    });

    it("applies w-10 h-10 text-sm for size=40", () => {
      const { container } = render(<Avatar name="Test User" size={40} />);
      expect(container.querySelector("span")?.className).toContain("w-10");
      expect(container.querySelector("span")?.className).toContain("h-10");
      expect(container.querySelector("span")?.className).toContain("text-sm");
    });
  });

  describe("tone variations", () => {
    it('applies signal tone by default', () => {
      const { container } = render(<Avatar name="Test User" tone="signal" />);
      const className = container.querySelector("span")?.className ?? "";
      expect(className).toContain("bg-[var(--signal-bg)]");
      expect(className).toContain("text-[var(--signal-ink)]");
    });

    it('applies ink tone', () => {
      const { container } = render(<Avatar name="Test User" tone="ink" />);
      const className = container.querySelector("span")?.className ?? "";
      expect(className).toContain("bg-[var(--ink)]");
      expect(className).toContain("text-[var(--paper)]");
    });

    it('applies mute tone', () => {
      const { container } = render(<Avatar name="Test User" tone="mute" />);
      const className = container.querySelector("span")?.className ?? "";
      expect(className).toContain("bg-[var(--paper-3)]");
      expect(className).toContain("text-[var(--ink-2)]");
    });
  });

  it("applies flex-shrink-0 class", () => {
    const { container } = render(<Avatar name="Test" />);
    expect(container.querySelector("span")?.className).toContain("flex-shrink-0");
  });

  it("applies rounded-full class", () => {
    const { container } = render(<Avatar name="Test" />);
    expect(container.querySelector("span")?.className).toContain("rounded-full");
  });

  it("applies font-medium class", () => {
    const { container } = render(<Avatar name="Test" />);
    expect(container.querySelector("span")?.className).toContain("font-medium");
  });
});