import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FileUploader } from "./FileUploader";

describe("FileUploader", () => {
  it("shows the default JSON 50MB upload policy", () => {
    render(<FileUploader onFileSelect={vi.fn()} />);

    expect(screen.getByText("Support for a single JSON file upload up to 50MB.")).toBeInTheDocument();
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("uses JSON wording while analyzing", () => {
    render(<FileUploader onFileSelect={vi.fn()} status="analyzing" />);

    expect(screen.getByText("Analyzing JSON Log...")).toBeInTheDocument();
    expect(screen.queryByText("Analyzing CSV Log...")).not.toBeInTheDocument();
  });
});
