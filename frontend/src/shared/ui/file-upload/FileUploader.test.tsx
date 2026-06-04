import { fireEvent, render, screen } from "@testing-library/react";
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

  it("selects files from drag-and-drop and file input changes", () => {
    const onFileSelect = vi.fn();
    const { container } = render(<FileUploader onFileSelect={onFileSelect} />);
    const uploader = container.firstElementChild as HTMLElement;
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const droppedFile = new File(["drop"], "drop.zip", { type: "application/zip" });
    const selectedFile = new File(["select"], "select.zip", { type: "application/zip" });

    fireEvent.dragEnter(uploader);
    fireEvent.dragLeave(uploader);
    fireEvent.drop(uploader, { dataTransfer: { files: [droppedFile] } });
    fireEvent.change(input, { target: { files: [selectedFile] } });

    expect(onFileSelect).toHaveBeenCalledWith(droppedFile);
    expect(onFileSelect).toHaveBeenCalledWith(selectedFile);
  });

  it("ignores drag, drop, input, and click interactions while disabled", () => {
    const onFileSelect = vi.fn();
    const inputClick = vi.spyOn(HTMLInputElement.prototype, "click");
    const { container } = render(<FileUploader onFileSelect={onFileSelect} disabled />);
    const uploader = container.firstElementChild as HTMLElement;
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["data"], "data.zip", { type: "application/zip" });

    fireEvent.dragEnter(uploader);
    fireEvent.drop(uploader, { dataTransfer: { files: [file] } });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(uploader);

    expect(input).toBeDisabled();
    expect(onFileSelect).not.toHaveBeenCalled();
    expect(inputClick).not.toHaveBeenCalled();

    inputClick.mockRestore();
  });
});
