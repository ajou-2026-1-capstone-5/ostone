import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";

const mockMutate = vi.fn();
const mockNavigate = vi.fn();
const mockReset = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

let callOnSuccess: (() => void) | null = null;

vi.mock("../../../shared/api/generated/endpoints/dataset-controller/dataset-controller", () => ({
  useUploadRawFile: (config: { mutation?: { onSuccess?: () => void } }) => {
    callOnSuccess = config?.mutation?.onSuccess ?? null;
    return {
      mutate: (...args: unknown[]) => {
        mockMutate(...args);
        callOnSuccess?.();
      },
      isPending: false,
      reset: mockReset,
    };
  },
}));

vi.mock("../../../shared/ui/file-upload/FileUploader", () => ({
  FileUploader: ({
    onFileSelect,
    status,
    acceptedTypes,
    acceptedTypeLabel,
    maxSizeLabel,
    fileTypeLabels,
  }: {
    onFileSelect: (f: File) => void;
    status: string;
    acceptedTypes: string;
    acceptedTypeLabel: string;
    maxSizeLabel: string;
    fileTypeLabels: string[];
  }) => (
    <div data-testid="file-uploader">
      {status}
      <span data-testid="accepted-types">{acceptedTypes}</span>
      <span data-testid="policy-copy">
        {acceptedTypeLabel} {maxSizeLabel} {fileTypeLabels.join(",")}
      </span>
      <input
        data-testid="file-input"
        type="file"
        onChange={(e) => {
          if (e.target.files?.[0]) onFileSelect(e.target.files[0]);
        }}
      />
    </div>
  ),
}));

import { LogUploadForm } from "./LogUploadForm";

describe("LogUploadForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders upload header and file uploader", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    expect(screen.getByText("상담 로그 업로드")).toBeInTheDocument();
    expect(screen.getByTestId("file-uploader")).toBeInTheDocument();
    expect(screen.getByTestId("accepted-types")).toHaveTextContent(".json,application/json");
    expect(screen.getByTestId("policy-copy")).toHaveTextContent("JSON 50MB JSON");
  });

  it("shows file preview and Start Processing button after selecting a file", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["test"], "test.json", { type: "application/json" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText("처리 시작")).toBeInTheDocument();
    expect(screen.getByText("test.json")).toBeInTheDocument();
  });

  it("rejects non-JSON files with toast error", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["test"], "test.csv", { type: "text/csv" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("JSON 파일만 업로드할 수 있습니다.");
  });

  it("rejects files larger than 50MB with toast error", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["test"], "big.json", { type: "application/json" });
    Object.defineProperty(file, "size", { value: 51 * 1024 * 1024 });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("파일 크기는 50MB 이하여야 합니다.");
  });

  it("calls mutate on Start Processing click", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.json", { type: "application/json" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));
    expect(mockMutate).toHaveBeenCalled();
  });

  it("does not call mutate when workspaceId is undefined", () => {
    render(<LogUploadForm />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.json", { type: "application/json" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    const btn = screen.queryByText("처리 시작");
    if (btn) fireEvent.click(btn);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("shows success actions after successful upload", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.json", { type: "application/json" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));
    expect(screen.getByText("다른 파일 업로드")).toBeInTheDocument();
    expect(screen.getByText("도메인팩 보기")).toBeInTheDocument();
  });

  it("navigates to domain packs on success action click", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.json", { type: "application/json" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));
    fireEvent.click(screen.getByText("도메인팩 보기"));
    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/1/domain-packs");
  });

  it("resets form state when Upload Another File is clicked", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.json", { type: "application/json" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));
    expect(screen.getByText("다른 파일 업로드")).toBeInTheDocument();
    fireEvent.click(screen.getByText("다른 파일 업로드"));
    expect(mockReset).toHaveBeenCalled();
    expect(screen.queryByText("다른 파일 업로드")).not.toBeInTheDocument();
    expect(screen.getByText("상담 로그 업로드")).toBeInTheDocument();
  });
});
