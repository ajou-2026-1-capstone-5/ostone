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
let callUploadOnError: ((error: unknown) => void) | null = null;
let callTriggerOnSuccess: ((response: unknown, variables: TriggerVariables) => void) | null = null;
let callTriggerOnError: ((error: unknown) => void) | null = null;
let mockUploadError: Error | null = null;

vi.mock("../../../shared/api/generated/endpoints/dataset-controller/dataset-controller", () => ({
  useUploadRawFile: (config: {
    mutation?: {
      onSuccess?: (response: unknown, variables: UploadVariables) => void;
      onError?: (error: unknown) => void;
    };
  }) => {
    callUploadOnSuccess = config?.mutation?.onSuccess ?? null;
    callUploadOnError = config?.mutation?.onError ?? null;
    return {
      mutate: (...args: unknown[]) => {
        mockUploadMutate(...args);
        if (mockUploadError) {
          callUploadOnError?.(mockUploadError);
          return;
        }
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
    callUploadOnSuccess = null;
    callUploadOnError = null;
    callTriggerOnSuccess = null;
    callTriggerOnError = null;
    mockUploadError = null;
  });

  it("renders upload header and file uploader", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    expect(screen.getByText("상담 로그 업로드")).toBeInTheDocument();
    expect(
      screen.getByText("상담로그를 업로드 하면 챗봇이 작동할 수 있는 데이터가 생성됩니다."),
    ).toBeInTheDocument();
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
    expect(mockUploadMutate).toHaveBeenCalled();
  });

  it("does not call mutate when workspaceId is undefined", () => {
    render(<LogUploadForm />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.json", { type: "application/json" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    const btn = screen.queryByText("처리 시작");
    if (btn) fireEvent.click(btn);
    expect(mockUploadMutate).not.toHaveBeenCalled();
  });

  it("shows generation CTA after successful upload", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.json", { type: "application/json" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));
    expect(screen.getByText("다른 파일 업로드")).toBeInTheDocument();
    expect(screen.getByText("도메인팩 초안 생성 시작")).toBeInTheDocument();
    expect(screen.getByText(/dataset 42/)).toBeInTheDocument();
    expect(screen.queryByText("도메인팩 보기")).not.toBeInTheDocument();
  });

  it("shows upload failure toast with retry action", () => {
    mockUploadError = new Error("업로드 실패");
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.json", { type: "application/json" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "업로드 실패",
      expect.objectContaining({
        action: expect.objectContaining({ label: "재시도" }),
      }),
    );

    mockUploadError = null;
    const retryAction = vi.mocked(toast.error).mock.calls[0]?.[1]?.action;
    retryAction?.onClick();

    expect(mockUploadMutate).toHaveBeenCalledTimes(2);
  });

  it("triggers domain pack generation with uploaded dataset id", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.json", { type: "application/json" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));
    fireEvent.click(screen.getByText("도메인팩 초안 생성 시작"));
    expect(mockTriggerMutate).toHaveBeenCalledWith({ workspaceId: 1, datasetId: 42 });
  });

  it("shows domain pack link after generation request succeeds", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.json", { type: "application/json" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));
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
    const file = new File(["data"], "data.json", { type: "application/json" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));
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
    const file = new File(["data"], "data.json", { type: "application/json" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));
    expect(screen.getByText("다른 파일 업로드")).toBeInTheDocument();
    fireEvent.click(screen.getByText("다른 파일 업로드"));
    expect(mockUploadReset).toHaveBeenCalled();
    expect(mockTriggerReset).toHaveBeenCalled();
    expect(screen.queryByText("다른 파일 업로드")).not.toBeInTheDocument();
    expect(screen.getByText("상담 로그 업로드")).toBeInTheDocument();
  });
});
