import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it } from "vitest";
import { Eyebrow } from "./Eyebrow";

describe("Eyebrow", () => {
  it("renders children", () => {
    render(<Eyebrow>label text</Eyebrow>);
    expect(screen.getByText("label text")).toBeInTheDocument();
  });

  it("renders as span element", () => {
    render(<Eyebrow>text</Eyebrow>);
    expect(screen.getByText("text").tagName).toBe("SPAN");
  });

  it("applies t-eyebrow class", () => {
    render(<Eyebrow>text</Eyebrow>);
    expect(screen.getByText("text").className).toContain("t-eyebrow");
  });

  describe("tone variations", () => {
    it('applies mute tone by default', () => {
      render(<Eyebrow>tone mute</Eyebrow>);
      expect(screen.getByText("tone mute").className).toContain("text-[var(--ink-3)]");
    });

    it('applies ink tone', () => {
      render(<Eyebrow tone="ink">tone ink</Eyebrow>);
      expect(screen.getByText("tone ink").className).toContain("text-[var(--ink)]");
    });

    it('applies signal tone', () => {
      render(<Eyebrow tone="signal">tone signal</Eyebrow>);
      expect(screen.getByText("tone signal").className).toContain("text-[var(--signal)]");
    });
  });

  it("applies custom className", () => {
    render(<Eyebrow className="custom-class">text</Eyebrow>);
    expect(screen.getByText("text").className).toContain("custom-class");
  });

  it("renders nested children", () => {
    render(
      <Eyebrow>
        <strong>bold label</strong>
      </Eyebrow>
    );
    expect(screen.getByText("bold label")).toBeInTheDocument();
  });
});
