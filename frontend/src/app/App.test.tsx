import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vite-plus/test";
import { App } from "./App";

describe("App", () => {
  it("renders without crashing", () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  it("renders login page title on initial load", () => {
    render(<App />);
    expect(screen.getByText(/CS Workflow Generator/i)).toBeInTheDocument();
  });

  it("renders hello world", () => {
    render(<App />);
    expect(screen.getByText(/hello world/i)).toBeInTheDocument();
  });
});
