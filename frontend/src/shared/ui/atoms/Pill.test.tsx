import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it } from "vitest";
import { Pill } from "./Pill";

describe("Pill", () => {
  it("renders children", () => {
    render(<Pill>label</Pill>);
    expect(screen.getByText("label")).toBeInTheDocument();
  });

  it("renders as span element", () => {
    render(<Pill>text</Pill>);
    expect(screen.getByText("text").tagName).toBe("SPAN");
  });

  describe("tone variations", () => {
    it('applies signal bg for tone="signal" (default)', () => {
      render(<Pill tone="signal">label</Pill>);
      expect(screen.getByText("label").className).toContain("bg-[var(--signal-bg)]");
    });

    it('applies warn bg for tone="warn"', () => {
      render(<Pill tone="warn">label</Pill>);
      expect(screen.getByText("label").className).toContain("bg-[var(--warn-bg)]");
    });

    it('applies danger bg for tone="danger"', () => {
      render(<Pill tone="danger">label</Pill>);
      expect(screen.getByText("label").className).toContain("bg-[var(--danger-bg)]");
    });

    it('applies info bg for tone="info"', () => {
      render(<Pill tone="info">label</Pill>);
      expect(screen.getByText("label").className).toContain("bg-[var(--info-bg)]");
    });

    it('applies mute bg for tone="mute"', () => {
      render(<Pill tone="mute">label</Pill>);
      expect(screen.getByText("label").className).toContain("bg-[var(--paper-3)]");
    });

    it('applies ink bg for tone="ink"', () => {
      render(<Pill tone="ink">label</Pill>);
      expect(screen.getByText("label").className).toContain("bg-[var(--ink)]");
    });
  });

  describe("dark tone variations", () => {
    it('applies dark signal bg for dark tone="signal"', () => {
      render(<Pill tone="signal" dark>label</Pill>);
      expect(screen.getByText("label").className).toContain("bg-[var(--signal-ink)]");
    });

    it('applies dark warn bg for dark tone="warn"', () => {
      render(<Pill tone="warn" dark>label</Pill>);
      expect(screen.getByText("label").className).toContain("bg-[var(--warn-ink)]");
    });

    it('applies dark danger bg for dark tone="danger"', () => {
      render(<Pill tone="danger" dark>label</Pill>);
      expect(screen.getByText("label").className).toContain("bg-[var(--danger-ink)]");
    });

    it('applies dark info bg for dark tone="info"', () => {
      render(<Pill tone="info" dark>label</Pill>);
      expect(screen.getByText("label").className).toContain("bg-[var(--info-ink)]");
    });

    it('applies dark mute bg for dark tone="mute"', () => {
      render(<Pill tone="mute" dark>label</Pill>);
      expect(screen.getByText("label").className).toContain("bg-[var(--ink-2)]");
    });

    it('applies dark ink bg for dark tone="ink"', () => {
      render(<Pill tone="ink" dark>label</Pill>);
      expect(screen.getByText("label").className).toContain("bg-[var(--paper)]");
    });
  });

  describe("size variations", () => {
    it('applies sm size classes for size="sm"', () => {
      render(<Pill size="sm">small</Pill>);
      const el = screen.getByText("small");
      expect(el.className).toContain("px-1");
      expect(el.className).toContain("text-[10px]");
    });

    it('applies md size classes for size="md" (default)', () => {
      render(<Pill size="md">medium</Pill>);
      const el = screen.getByText("medium");
      expect(el.className).toContain("px-2");
      expect(el.className).toContain("text-[11px]");
    });
  });

  describe("active state", () => {
    it("does not apply ring class when active is false", () => {
      render(<Pill active={false}>label</Pill>);
      const className = screen.getByText("label").className;
      expect(className).not.toContain("ring-1");
    });

    it("applies ring class when active is true", () => {
      render(<Pill active>label</Pill>);
      const className = screen.getByText("label").className;
      expect(className).toContain("ring-1");
      expect(className).toContain("ring-[var(--ring)]");
    });
  });

  it("applies base typography classes", () => {
    render(<Pill>label</Pill>);
    const el = screen.getByText("label");
    const className = el.className;
    expect(className).toContain("inline-flex");
    expect(className).toContain("font-mono");
    expect(className).toContain("uppercase");
  });

  it("renders nested children", () => {
    render(
      <Pill>
        <strong>bold label</strong>
      </Pill>
    );
    expect(screen.getByText("bold label")).toBeInTheDocument();
  });
});
