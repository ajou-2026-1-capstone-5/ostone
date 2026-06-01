import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FileUploader } from "./FileUploader";

describe("FileUploader", () => {
  it("shows the default JSON 50MB upload policy", () => {
    render(<FileUploader onFileSelect={vi.fn()} />);

    expect(screen.getByText(/JSON 파일 1개를 업로드할 수 있습니다\. 최대 50MB\./)).toBeInTheDocument();
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("uses JSON wording while analyzing", () => {
    render(<FileUploader onFileSelect={vi.fn()} status="analyzing" />);

    expect(screen.getByText("상담 로그 분석 중...")).toBeInTheDocument();
    expect(screen.queryByText("CSV 로그 분석 중...")).not.toBeInTheDocument();
  });
});
