import { describe, it, expect } from "vite-plus/test";
import { render } from "@testing-library/react";
import { SparkLine, SparkBars } from "./Spark";

describe("SparkLine", () => {
  it("renders an svg", () => {
    const { container } = render(<SparkLine data={[1, 2, 3, 4]} />);
    expect(container.firstElementChild).toBeInstanceOf(SVGSVGElement);
  });

  it("returns null for empty data", () => {
    const { container } = render(<SparkLine data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders polyline and last-point circle", () => {
    const { container } = render(<SparkLine data={[1, 2, 3]} />);
    const svg = container.firstElementChild as SVGSVGElement;
    expect(svg.querySelector("polyline")).toBeInTheDocument();
    expect(svg.querySelector("circle")).toBeInTheDocument();
  });
});

describe("SparkBars", () => {
  it("renders an svg", () => {
    const { container } = render(<SparkBars data={[1, 2, 3, 4, 5]} />);
    expect(container.firstElementChild).toBeInstanceOf(SVGSVGElement);
  });

  it("returns null for empty data", () => {
    const { container } = render(<SparkBars data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders rects equal to data length", () => {
    const { container } = render(<SparkBars data={[1, 2, 3, 4, 5]} />);
    const svg = container.firstElementChild as SVGSVGElement;
    expect(svg.querySelectorAll("rect")).toHaveLength(5);
  });
});
