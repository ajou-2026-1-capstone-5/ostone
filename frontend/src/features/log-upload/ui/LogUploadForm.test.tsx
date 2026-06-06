import { act, render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";

import type { CompleteRawFileUploadResponse } from "../api/rawFileUpload";

const mockUploadStart = vi.fn();
const mockUploadCancel = vi.fn();
const mockUploadReset = vi.fn();
const mockTriggerMutate = vi.fn();
const mockNavigate = vi.fn();
const mockTriggerReset = vi.fn();
const mockIngestionRefetch = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

type StartParams = {
  workspaceId: number;
  file: File;
  onSuccess: (result: CompleteRawFileUploadResponse) => void;
  onError: (message: string) => void;
};
type TriggerVariables = { workspaceId: number; datasetId: number };

let startBehavior: "success" | "error" | "pending" = "success";
let startError = "업로드 실패";
let lastStartParams: StartParams | null = null;
let callTriggerOnSuccess:
  | ((response: unknown, variables: TriggerVariables) => void)
  | null = null;
let callTriggerOnError: ((error: unknown) => void) | null = null;
let mockTriggerIsPending = false;
let mockIngestionQuery = {
  data: { pipelineJob: null },
  isLoading: false,
  isError: false,
  isFetching: false,
};

vi.mock("../model/useRawFileUpload", () => ({
  useRawFileUpload: () => ({
    isUploading: false,
    progress: 0,
    start: (params: StartParams) => {
      lastStartParams = params;
      mockUploadStart(params);
      if (startBehavior === "error") {
        params.onError(startError);
        return;
      }
      if (startBehavior === "pending") {
        return;
      }
      params.onSuccess({
        datasetId: 42,
        datasetKey: "key",
        workspaceId: params.workspaceId,
        objectKey: "obj",
        sizeBytes: 100,
        status: "READY",
      });
    },
    cancel: mockUploadCancel,
    reset: mockUploadReset,
  }),
}));

vi.mock("../model/useLatestDatasetPipelineJob", () => ({
  useLatestDatasetPipelineJob: () => ({
    ...mockIngestionQuery,
    refetch: mockIngestionRefetch,
  }),
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
        isPending: mockTriggerIsPending,
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
    disabled,
  }: {
    onFileSelect: (f: File) => void;
    status: string;
    acceptedTypes: string;
    acceptedTypeLabel: string;
    maxSizeLabel: string;
    fileTypeLabels: string[];
    disabled?: boolean;
  }) => (
    <div data-testid="file-uploader">
      {status}
      <span data-testid="uploader-disabled">{String(disabled)}</span>
      <span data-testid="accepted-types">{acceptedTypes}</span>
      <span data-testid="policy-copy">
        {acceptedTypeLabel} {maxSizeLabel} {fileTypeLabels.join(",")}
      </span>
      <input
        data-testid="file-input"
        type="file"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.[0]) onFileSelect(e.target.files[0]);
        }}
      />
      <button
        type="button"
        data-testid="force-file-select"
        onClick={() =>
          onFileSelect(
            new File(["data"], "blocked.zip", { type: "application/zip" }),
          )
        }
      >
        force select
      </button>
    </div>
  ),
}));

import { LogUploadForm } from "./LogUploadForm";

describe("LogUploadForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startBehavior = "success";
    startError = "업로드 실패";
    lastStartParams = null;
    callTriggerOnSuccess = null;
    callTriggerOnError = null;
    mockTriggerIsPending = false;
    mockIngestionQuery = {
      data: { pipelineJob: null },
      isLoading: false,
      isError: false,
      isFetching: false,
    };
  });

  it("renders upload header and file uploader", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    expect(screen.getByText("상담 로그 업로드")).toBeInTheDocument();
    expect(
      screen.getByText(
        "상담로그를 업로드 하면 챗봇이 작동할 수 있는 데이터가 생성됩니다.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("무료 온보딩 가능")).toBeInTheDocument();
    expect(screen.getByTestId("file-uploader")).toBeInTheDocument();
    expect(screen.getByTestId("accepted-types")).toHaveTextContent(
      ".zip,application/zip,application/x-zip-compressed",
    );
    expect(screen.getByTestId("policy-copy")).toHaveTextContent("ZIP 4GB ZIP");
  });

  it("shows in-progress onboarding state", () => {
    render(
      <LogUploadForm workspaceId={1} freeOnboardingStatus="IN_PROGRESS" />,
      {
        wrapper: MemoryRouter,
      },
    );

    expect(screen.getByText("무료 온보딩 진행 중")).toBeInTheDocument();
    expect(
      screen.getByText(/도메인팩 초안 생성과 검토 진입/),
    ).toBeInTheDocument();
  });

  it("blocks upload when free onboarding is consumed without active subscription", () => {
    render(
      <LogUploadForm
        workspaceId={1}
        freeOnboardingStatus="CONSUMED"
        hasActiveSubscription={false}
      />,
      { wrapper: MemoryRouter },
    );

    expect(screen.getByText("무료 온보딩 사용 완료")).toBeInTheDocument();
    expect(screen.getByTestId("uploader-disabled")).toHaveTextContent("true");
    expect(screen.getByTestId("file-input")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "구독/결제 화면으로 이동" }),
    ).toBeInTheDocument();
  });

  it("navigates blocked free onboarding workspaces to workspace billing", () => {
    render(
      <LogUploadForm
        workspaceId={1}
        freeOnboardingStatus="CONSUMED"
        hasActiveSubscription={false}
      />,
      { wrapper: MemoryRouter },
    );

    fireEvent.click(
      screen.getByRole("button", { name: "구독/결제 화면으로 이동" }),
    );

    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/1/billing");
  });

  it("shows a toast when a blocked workspace still receives a selected file", () => {
    render(
      <LogUploadForm
        workspaceId={1}
        freeOnboardingStatus="CONSUMED"
        hasActiveSubscription={false}
      />,
      { wrapper: MemoryRouter },
    );

    fireEvent.click(screen.getByTestId("force-file-select"));

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "무료 온보딩이 사용 완료되었습니다. 구독을 활성화한 뒤 업로드할 수 있습니다.",
    );
  });

  it("disables processing when a selected file becomes ineligible before upload", () => {
    const { rerender } = render(
      <LogUploadForm
        workspaceId={1}
        freeOnboardingStatus="AVAILABLE"
        hasActiveSubscription={false}
      />,
      { wrapper: MemoryRouter },
    );
    const file = new File(["data"], "data.zip", { type: "application/zip" });
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [file] },
    });

    rerender(
      <LogUploadForm
        workspaceId={1}
        freeOnboardingStatus="CONSUMED"
        hasActiveSubscription={false}
      />,
    );

    expect(screen.getByText("처리 시작").closest("button")).toBeDisabled();
    expect(mockUploadStart).not.toHaveBeenCalled();
  });

  it("allows upload when free onboarding is consumed but subscription is active", () => {
    render(
      <LogUploadForm
        workspaceId={1}
        freeOnboardingStatus="CONSUMED"
        hasActiveSubscription
      />,
      { wrapper: MemoryRouter },
    );

    expect(screen.getByText(/활성 구독이 적용되어/)).toBeInTheDocument();
    expect(screen.getByTestId("uploader-disabled")).toHaveTextContent("false");
  });

  it("blocks upload while a paid workspace is in domain pack operation cooldown", () => {
    render(
      <LogUploadForm
        workspaceId={1}
        hasActiveSubscription
        paidUploadCooldown={{
          isBlocked: true,
          nextAvailableAt: "2026-06-04T10:30:00+09:00",
        }}
      />,
      { wrapper: MemoryRouter },
    );

    expect(screen.getByText("도메인팩 작업 쿨다운 중")).toBeInTheDocument();
    expect(screen.getByText(/재개 가능 시점/)).toBeInTheDocument();
    expect(screen.getByTestId("uploader-disabled")).toHaveTextContent("true");
    expect(screen.getByTestId("file-input")).toBeDisabled();
    expect(screen.getByRole("button", { name: "처리 시작" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "구독/결제 화면으로 이동" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("force-file-select"));

    expect(mockUploadStart).not.toHaveBeenCalled();
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      expect.stringContaining("도메인팩 생성·검토 시간당 한도"),
    );
  });

  it("keeps processing disabled until a file is selected", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });

    expect(screen.getByText("파일을 먼저 선택해 주세요.")).toBeInTheDocument();
    expect(
      screen.getByText("처리 시작 전에 ZIP 상담 로그 파일이 필요합니다."),
    ).toBeInTheDocument();

    const startButton = screen.getByRole("button", { name: "처리 시작" });
    expect(startButton).toBeDisabled();

    fireEvent.click(startButton);

    expect(mockUploadStart).not.toHaveBeenCalled();
  });

  it("shows file preview and Start Processing button after selecting a file", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["test"], "test.zip", { type: "application/zip" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole("button", { name: "처리 시작" })).toBeEnabled();
    expect(screen.getByText("test.zip")).toBeInTheDocument();
  });

  it("rejects non-ZIP files with toast error", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["test"], "test.json", { type: "application/json" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "ZIP 파일만 업로드할 수 있습니다.",
    );
  });

  it("rejects files larger than 4GB with toast error", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["test"], "big.zip", { type: "application/zip" });
    Object.defineProperty(file, "size", { value: 4 * 1024 * 1024 * 1024 + 1 });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "파일 크기는 4GB 이하여야 합니다.",
    );
  });

  it("starts the presigned upload on Start Processing click", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.zip", { type: "application/zip" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));
    expect(mockUploadStart).toHaveBeenCalled();
    expect(lastStartParams?.workspaceId).toBe(1);
    expect(lastStartParams?.file).toBe(file);
  });

  it("does not start upload when workspaceId is undefined", () => {
    render(<LogUploadForm />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.zip", { type: "application/zip" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    const btn = screen.queryByText("처리 시작");
    if (btn) fireEvent.click(btn);
    expect(mockUploadStart).not.toHaveBeenCalled();
  });

  it("shows generation CTA after successful upload", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.zip", { type: "application/zip" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));
    expect(screen.getByText("다른 파일 업로드")).toBeInTheDocument();
    expect(screen.getByText("파이프라인 준비 중")).toBeInTheDocument();
    expect(screen.getByText("도메인팩 초안 생성 시작")).toBeInTheDocument();
    expect(screen.getByText(/dataset 42/)).toBeInTheDocument();
    expect(screen.queryByText("도메인팩 관리로 이동")).not.toBeInTheDocument();
  });

  it("shows automatic ingestion pipeline status and opens status screen", () => {
    mockIngestionQuery = {
      data: {
        pipelineJob: {
          pipelineJobId: 77,
          workspaceId: 1,
          datasetId: 42,
          domainPackId: null,
          jobType: "INGESTION",
          status: "RUNNING",
          airflowDagId: "domain_pack_generation",
          airflowRunId: "pipeline_job_77",
          requestedAt: "2026-06-05T01:00:00Z",
          startedAt: "2026-06-05T01:00:10Z",
          finishedAt: null,
          runningDurationSeconds: 95,
          lastErrorMessage: null,
        },
      },
      isLoading: false,
      isError: false,
      isFetching: false,
    };

    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.zip", { type: "application/zip" });
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByText("처리 시작"));

    expect(screen.getByText("자동 생성 파이프라인")).toBeInTheDocument();
    expect(screen.getByText(/job 77 · pipeline_job_77/)).toBeInTheDocument();
    expect(screen.getByText("DAG domain_pack_generation")).toBeInTheDocument();
    expect(screen.getByText("실행 1분 35초")).toBeInTheDocument();

    fireEvent.click(screen.getByText("상태 화면으로 이동"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/workspaces/1/pipeline-jobs/77/review",
    );
  });

  it("shows upload failure toast with retry action", () => {
    startBehavior = "error";
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.zip", { type: "application/zip" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "업로드 실패",
      expect.objectContaining({
        action: expect.objectContaining({ label: "재시도" }),
      }),
    );

    startBehavior = "success";
    const retryAction = vi.mocked(toast.error).mock.calls[0]?.[1]?.action;
    retryAction?.onClick();

    expect(mockUploadStart).toHaveBeenCalledTimes(2);
  });

  it("triggers domain pack generation with uploaded dataset id", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.zip", { type: "application/zip" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));
    fireEvent.click(screen.getByText("도메인팩 초안 생성 시작"));
    expect(mockTriggerMutate).toHaveBeenCalledWith({
      workspaceId: 1,
      datasetId: 42,
    });
  });

  it("ignores rapid duplicate generation clicks before pending state re-renders", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.zip", { type: "application/zip" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));

    const triggerButton = screen.getByText("도메인팩 초안 생성 시작");
    fireEvent.click(triggerButton);
    fireEvent.click(triggerButton);

    expect(mockTriggerMutate).toHaveBeenCalledTimes(1);
    expect(screen.getByText("생성 요청 중")).toBeInTheDocument();
  });

  it("disables generation CTA while mutation is pending", () => {
    mockTriggerIsPending = true;

    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.zip", { type: "application/zip" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));

    expect(
      screen.getByText("도메인팩 초안 생성 시작").closest("button"),
    ).toBeDisabled();
  });

  it("shows review CTA after generation request succeeds with pipeline job id", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.zip", { type: "application/zip" });
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
    fireEvent.click(screen.getByText("검토 화면으로 이동"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/workspaces/1/pipeline-jobs/11/review",
    );

    fireEvent.click(screen.getByText("도메인팩 관리로 이동"));
    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/1/domain-packs");
  });

  it("keeps domain pack fallback when generation response has no pipeline job id", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.zip", { type: "application/zip" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));
    fireEvent.click(screen.getByText("도메인팩 초안 생성 시작"));
    act(() => {
      callTriggerOnSuccess?.(
        { status: "REQUESTED" },
        { workspaceId: 1, datasetId: 42 },
      );
    });

    expect(screen.getByText("생성 요청 완료")).toBeInTheDocument();
    expect(screen.queryByText("검토 화면으로 이동")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("도메인팩 관리로 이동"));
    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/1/domain-packs");
  });

  it("shows retry action when generation request fails", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.zip", { type: "application/zip" });
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText("처리 시작"));
    fireEvent.click(screen.getByText("도메인팩 초안 생성 시작"));
    act(() => {
      callTriggerOnError?.(new Error("Airflow 연결 실패"));
    });

    expect(screen.getByText("생성 요청 실패")).toBeInTheDocument();
    expect(screen.getByText("Airflow 연결 실패")).toBeInTheDocument();
    const retryButton = screen.getByText("다시 생성 요청");
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);
    expect(mockTriggerMutate).toHaveBeenCalledTimes(2);
  });

  it("resets form state when Upload Another File is clicked", () => {
    render(<LogUploadForm workspaceId={1} />, { wrapper: MemoryRouter });
    const file = new File(["data"], "data.zip", { type: "application/zip" });
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
