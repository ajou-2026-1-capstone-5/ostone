import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it } from "vitest";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

describe("Icon", () => {
  it("renders an svg element", () => {
    render(<Icon name="check" />);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders as svg element", () => {
    render(<Icon name="plus" />);
    expect(document.querySelector("svg")?.tagName).toBe("svg");
  });

  describe("icon name variations (sample 5+)", () => {
    const sampleIcons: IconName[] = [
      "check",
      "arrow",
      "plus",
      "search",
      "close",
      "user",
      "file",
    ];

    sampleIcons.forEach((name) => {
      it(`renders icon name="${name}"`, () => {
        render(<Icon name={name} />);
        const svg = document.querySelector("svg");
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
      });
    });
  });

  it("applies default size of 16", () => {
    render(<Icon name="check" />);
    const svg = document.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("height", "16");
  });

  it("applies custom size", () => {
    render(<Icon name="check" size={24} />);
    const svg = document.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
  });

  it("applies custom className", () => {
    render(<Icon name="check" className="custom-class" />);
    expect(document.querySelector("svg")).toHaveClass("custom-class");
  });

  it("applies shrink-0 class", () => {
    render(<Icon name="check" />);
    expect(document.querySelector("svg")).toHaveClass("shrink-0");
  });

  it("applies stroke=currentColor", () => {
    render(<Icon name="check" />);
    expect(document.querySelector("svg")).toHaveAttribute("stroke", "currentColor");
  });

  it("applies strokeWidth=1.5", () => {
    render(<Icon name="check" />);
    expect(document.querySelector("svg")).toHaveAttribute("stroke-width", "1.5");
  });

  it("applies fill=none", () => {
    render(<Icon name="check" />);
    expect(document.querySelector("svg")).toHaveAttribute("fill", "none");
  });

  it("applies xmlns attribute", () => {
    render(<Icon name="check" />);
    expect(document.querySelector("svg")).toHaveAttribute(
      "xmlns",
      "http://www.w3.org/2000/svg"
    );
  });

  it("passes through additional SVG attributes", () => {
    render(<Icon name="check" aria-label="my icon" />);
    expect(document.querySelector("svg")).toHaveAttribute("aria-label", "my icon");
  });

  it("renders compound icons with multiple path elements (file icon)", () => {
    render(<Icon name="file" />);
    const svg = document.querySelector("svg")!;
    const paths = svg.querySelectorAll("path, polyline");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("renders icon with polygon (play)", () => {
    render(<Icon name="play" />);
    const svg = document.querySelector("svg")!;
    expect(svg.querySelector("polygon")).toBeInTheDocument();
  });

  it("renders icon with circle (user)", () => {
    render(<Icon name="user" />);
    const svg = document.querySelector("svg")!;
    expect(svg.querySelector("circle")).toBeInTheDocument();
  });
});