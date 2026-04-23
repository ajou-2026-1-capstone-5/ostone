import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vite-plus/test";
import { App } from "./App";
import { AppProviders } from "./providers";

describe("App", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    expect(container).toBeTruthy();
  });

  it("renders login page title on initial load", () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    expect(screen.getByText(/CS Workflow Generator/i)).toBeInTheDocument();
  });
});
