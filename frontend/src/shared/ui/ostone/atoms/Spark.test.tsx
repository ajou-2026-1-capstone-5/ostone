import { describe, it, expect } from "vite-plus/test";
import { render } from "@testing-library/react";
import { SparkLine, SparkBars } from "./Spark";

describe("SparkLine", () => {
  it("renders an svg", () => {
    render(<SparkLine data={[1, 2, 3, 4]} />);
    expect(document.querySelector("svg")).toBeTruthy();
  });

  it("returns null for empty data", () => {
    const { container } = render(<SparkLine data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders polyline and last-point circle", () => {
    render(<SparkLine data={[1, 2, 3]} />);
    expect(document.querySelector("polyline")).toBeTruthy();
    expect(document.querySelector("circle")).toBeTruthy();
  });
});

describe("SparkBars", () => {
  it("renders an svg", () => {
    render(<SparkBars data={[1, 2, 3, 4, 5]} />);
    expect(document.querySelector("svg")).toBeTruthy();
  });

  it("returns null for empty data", () => {
    const { container } = render(<SparkBars data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders rects equal to data length", () => {
    render(<SparkBars data={[1, 2, 3, 4, 5]} />);
    expect(document.querySelectorAll("rect").length).toBe(5);
  });
});
