import { act, render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";

const mockUploadMutate = vi.fn();
const mockTriggerMutate = vi.fn();
const mockNavigate = vi.fn();
const mockUploadReset = vi.fn();
const mockTriggerReset = vi.fn();

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

type UploadVariables = { data?: { file?: File } };
type TriggerVariables = { workspaceId: number; datasetId: number };

let callUploadOnSuccess: ((response: unknown, variables: UploadVariables) => void) | null = null;
let callTriggerOnSuccess: ((response: unknown, variables: TriggerVariables) => void) | null = null;
let callTriggerOnError: ((error: unknown) => void) | null = null;

vi.mock("../../../shared/api/generated/endpoints/dataset-controller/dataset-controller", () => ({
  useUploadRawFile: (config: {
    mutation?: { onSuccess?: (response: unknown, variables: UploadVariables) => void };
  }) => {
    callUploadOnSuccess = config?.mutation?.onSuccess ?? null;
    return {
      mutate: (...args: unknown[]) => {
        mockUploadMutate(...args);
        const variables = args[0] as UploadVariables;
        callUploadOnSuccess?.({ datasetId: 42, conversationCount: 7 }, variables);
      },
      isPending: false,
      reset: mockUploadReset,
    };
  },
}));

vi.mock(
  "../../../shared/api/generated/endpoints/domain-pack-generation-trigger-controller/domain-pack-generation-trigger-controller",
  () => ({
    useTriggerDomainPackGeneration: (config: {
      mutation?: {
        onSuccess?: (response: unknown, variables: TriggerVariables) => void;
        onError?: (error: unknown) => void;
      };
    }) => {
      callTriggerOnSuccess = config?.mutation?.onSuccess ?? null;
      callTriggerOnError = config?.mutation?.onError ?? null;
      return {
        mutate: (...args: unknown[]) => {
          mockTriggerMutate(...args);
        },
        isPending: false,
        reset: mockTriggerReset,
      };
    },
  }),
);

vi.mock("../../../shared/ui/file-upload/FileUploader", () => ({
  FileUploader: ({ onFileSelect, status }: { onFileSelect: (f: File) => void; status: string }) => (
    <div data-testid="file-uploader">
      {status}
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
    callUploadOnSuccess = null;
    callTriggerOnSuccess = null;
    callTriggerOnError = null;
  });

  it("renders upload header and file uploader", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    expect(screen.getByText("상담 로그 업로드")).toBeInTheDocument();
    expect(screen.getByTestId("file-uploader")).toBeInTheDocument();
  });

  it("shows file preview and Start Processing button after selecting a file", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["test"], "test.csv", { type: "text/csv" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText("Start Processing")).toBeInTheDocument();
    expect(screen.getByText("test.csv")).toBeInTheDocument();
  });

  it("rejects non-CSV/JSON files with toast error", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["test"], "test.txt", { type: "text/plain" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "CSV 또는 JSON 파일만 업로드할 수 있습니다.",
    );
  });

  it("calls mutate on Start Processing click", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.csv", { type: "text/csv" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("Start Processing"));
    expect(mockUploadMutate).toHaveBeenCalled();
  });

  it("does not call mutate when workspaceId is undefined", () => {
    render(<LogUploadForm />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.csv", { type: "text/csv" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    const btn = screen.queryByText("Start Processing");
    if (btn) fireEvent.click(btn);
    expect(mockUploadMutate).not.toHaveBeenCalled();
  });

  it("shows generation CTA after successful upload", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.csv", { type: "text/csv" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("Start Processing"));
    expect(screen.getByText("Upload Another File")).toBeInTheDocument();
    expect(screen.getByText("도메인팩 초안 생성 시작")).toBeInTheDocument();
    expect(screen.getByText(/dataset 42/)).toBeInTheDocument();
    expect(screen.queryByText("도메인팩 보기")).not.toBeInTheDocument();
  });

  it("triggers domain pack generation with uploaded dataset id", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.csv", { type: "text/csv" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("Start Processing"));
    fireEvent.click(screen.getByText("도메인팩 초안 생성 시작"));
    expect(mockTriggerMutate).toHaveBeenCalledWith({ workspaceId: 1, datasetId: 42 });
  });

  it("shows domain pack link after generation request succeeds", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.csv", { type: "text/csv" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("Start Processing"));
    fireEvent.click(screen.getByText("도메인팩 초안 생성 시작"));
    act(() => {
      callTriggerOnSuccess?.(
        { pipelineJobId: 11, status: "REQUESTED" },
        { workspaceId: 1, datasetId: 42 },
      );
    });

    expect(screen.getByText("생성 요청 완료")).toBeInTheDocument();
    expect(screen.getByText(/job 11 · REQUESTED/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("도메인팩 보기"));
    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/1/domain-packs");
  });

  it("shows retry action when generation request fails", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.csv", { type: "text/csv" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("Start Processing"));
    fireEvent.click(screen.getByText("도메인팩 초안 생성 시작"));
    act(() => {
      callTriggerOnError?.(new Error("Airflow 연결 실패"));
    });

    expect(screen.getByText("생성 요청 실패")).toBeInTheDocument();
    expect(screen.getByText("Airflow 연결 실패")).toBeInTheDocument();
    fireEvent.click(screen.getByText("다시 생성 요청"));
    expect(mockTriggerMutate).toHaveBeenCalledTimes(2);
  });

  it("resets form state when Upload Another File is clicked", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.csv", { type: "text/csv" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("Start Processing"));
    expect(screen.getByText("Upload Another File")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Upload Another File"));
    expect(mockUploadReset).toHaveBeenCalled();
    expect(mockTriggerReset).toHaveBeenCalled();
    expect(screen.queryByText("Upload Another File")).not.toBeInTheDocument();
    expect(screen.getByText("상담 로그 업로드")).toBeInTheDocument();
  });
});
