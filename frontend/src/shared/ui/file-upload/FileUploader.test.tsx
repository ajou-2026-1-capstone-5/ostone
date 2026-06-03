import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FileUploader } from "./FileUploader";

describe("FileUploader", () => {
  it("shows the default ZIP 4GB upload policy", () => {
    render(<FileUploader onFileSelect={vi.fn()} />);

    expect(screen.getByText(/ZIP 파일 1개를 업로드할 수 있습니다\. 최대 4GB\./)).toBeInTheDocument();
    expect(screen.getByText("ZIP")).toBeInTheDocument();
  });

  it("uses 상담 로그 wording while analyzing", () => {
    render(<FileUploader onFileSelect={vi.fn()} status="analyzing" />);

    expect(screen.getByText("상담 로그 분석 중...")).toBeInTheDocument();
    expect(screen.queryByText("CSV 로그 분석 중...")).not.toBeInTheDocument();
  });
});
