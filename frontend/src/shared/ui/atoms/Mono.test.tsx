import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it } from "vitest";
import { Mono } from "./Mono";

describe("Mono", () => {
  it("renders children", () => {
    render(<Mono>hello world</Mono>);
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("renders as span by default", () => {
    render(<Mono>text</Mono>);
    expect(screen.getByText("text").tagName).toBe("SPAN");
  });

  it("renders as code when as='code'", () => {
    render(<Mono as="code">code text</Mono>);
    expect(screen.getByText("code text").tagName).toBe("CODE");
  });

  it("renders as span when as='span'", () => {
    render(<Mono as="span">span text</Mono>);
    expect(screen.getByText("span text").tagName).toBe("SPAN");
  });

  it("applies font-mono and tabular-nums class", () => {
    render(<Mono>mono text</Mono>);
    const el = screen.getByText("mono text");
    const className = el.className;
    expect(className).toContain("font-mono");
    expect(className).toContain("tabular-nums");
  });

  it("applies custom className", () => {
    render(<Mono className="custom-class">text</Mono>);
    expect(screen.getByText("text").className).toContain("custom-class");
  });

  it("applies size as fontSize inline style", () => {
    render(<Mono size={14}>sized text</Mono>);
    const el = screen.getByText("sized text");
    expect(el).toHaveStyle({ fontSize: "14px" });
  });

  it("does not apply style when size is undefined", () => {
    render(<Mono>no size</Mono>);
    const el = screen.getByText("no size");
    expect(el.style.fontSize).toBe("");
  });

  it("renders nested children", () => {
    render(
      <Mono>
        <span>inner</span>
      </Mono>
    );
    expect(screen.getByText("inner")).toBeInTheDocument();
  });
});