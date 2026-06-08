import { describe, it, expect } from "vite-plus/test";
import { render } from "@testing-library/react";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders an svg element for a valid name", () => {
    const { container } = render(<Icon name="search" />);
    expect(container.firstElementChild).toBeInstanceOf(SVGSVGElement);
  });

  it("returns null for undefined name", () => {
    const { container } = render(<Icon name={undefined as never} />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null for invalid name", () => {
    const { container } = render(<Icon name={"invalid" as never} />);
    expect(container.firstChild).toBeNull();
  });

  it("applies default size 16", () => {
    const { container } = render(<Icon name="arrow" />);
    expect(container.firstElementChild).toHaveAttribute("width", "16");
    expect(container.firstElementChild).toHaveAttribute("height", "16");
  });

  it("applies custom size", () => {
    const { container } = render(<Icon name="arrow" size={24} />);
    expect(container.firstElementChild).toHaveAttribute("width", "24");
    expect(container.firstElementChild).toHaveAttribute("height", "24");
  });

  it("accepts optional className", () => {
    const { container } = render(<Icon name="arrow" className="my-icon" />);
    expect(container.firstElementChild).toHaveClass("my-icon");
  });
});
