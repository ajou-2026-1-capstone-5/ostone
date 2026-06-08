import { describe, it, expect } from "vite-plus/test";
import { render } from "@testing-library/react";
import { Bar } from "./Bar";

describe("Bar", () => {
  it("renders outer and inner divs", () => {
    const { container } = render(<Bar value={0.5} />);
    const outer = container.firstElementChild;
    const inner = outer?.firstElementChild;
    expect(outer).toBeInstanceOf(HTMLDivElement);
    expect(inner).toBeInstanceOf(HTMLDivElement);
    expect(outer).toContainElement(inner as HTMLElement);
  });

  it("sets inner width to 50% for value 0.5", () => {
    const { container } = render(<Bar value={0.5} />);
    const outer = container.firstElementChild as HTMLDivElement;
    const inner = outer.firstElementChild as HTMLDivElement;
    expect(inner).toHaveStyle({ width: "50%" });
  });

  it("uses ink tone by default", () => {
    const { container } = render(<Bar value={0.5} />);
    const outer = container.firstElementChild as HTMLDivElement;
    const inner = outer.firstElementChild as HTMLDivElement;
    expect(inner).toHaveStyle({ background: "var(--ink-2)" });
  });

  it("uses signal tone when specified", () => {
    const { container } = render(<Bar value={0.5} tone="signal" />);
    const outer = container.firstElementChild as HTMLDivElement;
    const inner = outer.firstElementChild as HTMLDivElement;
    expect(inner).toHaveStyle({ background: "var(--signal)" });
  });

  it("applies custom width and height", () => {
    const { container } = render(<Bar value={0.5} w={120} h={6} />);
    expect(container.firstElementChild).toHaveStyle({ width: "120px", height: "6px" });
  });

  it("clamps value to 0-1 range", () => {
    const { container } = render(<Bar value={1.5} />);
    const outer = container.firstElementChild as HTMLDivElement;
    const inner = outer.firstElementChild as HTMLDivElement;
    expect(inner).toHaveStyle({ width: "150%" });
  });
});
