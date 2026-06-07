import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { AdminPipelineJobsPage } from "./AdminPipelineJobsPage";
import { ApiRequestError } from "@/shared/api";

const mocks = vi.hoisted(() => ({
  listAdminPipelineJobs: vi.fn(),
  retryAdminPipelineJob: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/features/admin", async () => {
  const actual = await vi.importActual<typeof import("@/features/admin")>("@/features/admin");
  return {
    ...actual,
    adminPipelineJobKeys: {
      all: ["admin", "pipeline-jobs"],
      list: (filters: unknown) => ["admin", "pipeline-jobs", "list", filters],
    },
    listAdminPipelineJobs: mocks.listAdminPipelineJobs,
    retryAdminPipelineJob: mocks.retryAdminPipelineJob,
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminPipelineJobsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminPipelineJobsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pipeline job 목록과 lag 초과 강조 및 retry 관계를 표시한다", async () => {
    mocks.listAdminPipelineJobs.mockResolvedValueOnce({
      items: [
        {
          pipelineJobId: 11,
          workspaceId: 1,
          datasetId: 7,
          domainPackId: null,
          jobType: "DOMAIN_PACK_GENERATION",
          status: "FAILED",
          airflowDagId: "domain_pack_generation",
          airflowRunId: "pipeline_job_11",
          requestedAt: "2026-06-03T01:00:00Z",
          startedAt: "2026-06-03T01:02:00Z",
          finishedAt: "2026-06-03T01:05:00Z",
          queueLagSeconds: 120,
          runningDurationSeconds: null,
          totalDurationSeconds: 300,
          lagExceeded: true,
          lastErrorMessage: "Airflow failed",
          retriedFromPipelineJobId: null,
          retryPipelineJobId: 12,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });

    renderPage();

    expect(await screen.findByText("#11")).toBeInTheDocument();
    expect(screen.getAllByText("FAILED").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2m")).toBeInTheDocument();
    expect(screen.getByText("5m")).toBeInTheDocument();
    expect(screen.getByText("retry #12")).toBeInTheDocument();
    expect(screen.getByText("Airflow failed")).toBeInTheDocument();
  });

  it("검토 대기 job에 review 화면 링크를 표시한다", async () => {
    mocks.listAdminPipelineJobs.mockResolvedValueOnce({
      items: [
        {
          pipelineJobId: 42,
          workspaceId: 2,
          datasetId: 38,
          domainPackId: null,
          jobType: "INGESTION",
          status: "WAITING_HUMAN_FEEDBACK",
          airflowDagId: "domain_pack_generation",
          airflowRunId: "pipeline_job_42",
          requestedAt: "2026-06-07T09:00:00Z",
          startedAt: "2026-06-07T09:01:00Z",
          finishedAt: null,
          queueLagSeconds: 60,
          runningDurationSeconds: null,
          totalDurationSeconds: null,
          lagExceeded: false,
          lastErrorMessage: null,
          retriedFromPipelineJobId: null,
          retryPipelineJobId: null,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });

    renderPage();

    expect(await screen.findByText("#42")).toBeInTheDocument();
    expect(screen.getAllByText("WAITING_HUMAN_FEEDBACK").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "pipeline job 42 검토 화면" })).toHaveAttribute(
      "href",
      "/workspaces/2/pipeline-jobs/42/review",
    );
  });

  it("필터 입력 후 조회하면 query parameter 상태로 목록 API를 호출한다", async () => {
    mocks.listAdminPipelineJobs.mockResolvedValue({
      items: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    });

    renderPage();

    await screen.findByText("조건에 맞는 pipeline job이 없습니다.");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "FAILED");
    await userEvent.type(screen.getByLabelText("Workspace"), "1");
    await userEvent.type(screen.getByLabelText("DAG"), "domain");
    await userEvent.type(screen.getByLabelText("Run"), "pipeline_job");
    await userEvent.click(screen.getByRole("button", { name: /조회/ }));

    await waitFor(() => {
      expect(mocks.listAdminPipelineJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "FAILED",
          workspaceId: "1",
          dagId: "domain",
          runId: "pipeline_job",
          lagThresholdSeconds: 300,
        }),
      );
    });
  });

  it("FAILED job 재시도 성공 시 toast를 표시하고 목록을 다시 조회한다", async () => {
    mocks.listAdminPipelineJobs.mockResolvedValue({
      items: [
        {
          pipelineJobId: 11,
          workspaceId: 1,
          datasetId: 7,
          domainPackId: null,
          jobType: "DOMAIN_PACK_GENERATION",
          status: "FAILED",
          airflowDagId: "domain_pack_generation",
          airflowRunId: "pipeline_job_11",
          requestedAt: "2026-06-03T01:00:00Z",
          startedAt: "2026-06-03T01:02:00Z",
          finishedAt: "2026-06-03T01:05:00Z",
          queueLagSeconds: 120,
          runningDurationSeconds: null,
          totalDurationSeconds: 300,
          lagExceeded: false,
          lastErrorMessage: null,
          retriedFromPipelineJobId: null,
          retryPipelineJobId: null,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    mocks.retryAdminPipelineJob.mockResolvedValueOnce({
      sourcePipelineJobId: 11,
      retryPipelineJobId: 12,
      workspaceId: 1,
      datasetId: 7,
      jobType: "DOMAIN_PACK_GENERATION",
      status: "RUNNING",
      airflowDagId: "domain_pack_generation",
      airflowRunId: "pipeline_job_12",
      requestedAt: "2026-06-03T02:00:00Z",
      startedAt: "2026-06-03T02:00:01Z",
    });

    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "pipeline job 11 재시도" }));

    await waitFor(() => {
      expect(mocks.retryAdminPipelineJob.mock.calls[0][0]).toBe(11);
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("새 pipeline job #12을 생성했습니다.");
    await waitFor(() => {
      expect(mocks.listAdminPipelineJobs).toHaveBeenCalledTimes(2);
    });
  });

  it("목록 오류와 재시도 오류 메시지를 toast와 alert로 표시한다", async () => {
    mocks.listAdminPipelineJobs
      .mockRejectedValueOnce(new ApiRequestError(401, "UNAUTHORIZED", "인증이 필요합니다."))
      .mockResolvedValueOnce({
        items: [
          {
            pipelineJobId: 11,
            workspaceId: 1,
            datasetId: null,
            domainPackId: null,
            jobType: "DOMAIN_PACK_GENERATION",
            status: "FAILED",
            airflowDagId: null,
            airflowRunId: null,
            requestedAt: "2026-06-03T01:00:00Z",
            startedAt: null,
            finishedAt: null,
            queueLagSeconds: null,
            runningDurationSeconds: null,
            totalDurationSeconds: null,
            lagExceeded: false,
            lastErrorMessage: null,
            retriedFromPipelineJobId: 10,
            retryPipelineJobId: null,
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      });
    mocks.retryAdminPipelineJob.mockRejectedValueOnce(
      new ApiRequestError(409, "PIPELINE_JOB_RETRY_NOT_ALLOWED", "FAILED job만 재시도할 수 있습니다."),
    );

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("인증이 필요합니다.");
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("from #10")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(1);

    await userEvent.click(screen.getByRole("button", { name: "pipeline job 11 재시도" }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("FAILED job만 재시도할 수 있습니다.");
    });
  });

  it("필터 초기화와 긴 duration 표시를 처리한다", async () => {
    mocks.listAdminPipelineJobs.mockResolvedValue({
      items: [
        {
          pipelineJobId: 22,
          workspaceId: 3,
          datasetId: 9,
          domainPackId: null,
          jobType: "DOMAIN_PACK_GENERATION",
          status: "RUNNING",
          airflowDagId: "dag",
          airflowRunId: "run",
          requestedAt: "2026-06-03T01:00:00Z",
          startedAt: "2026-06-03T01:01:00Z",
          finishedAt: null,
          queueLagSeconds: 3660,
          runningDurationSeconds: 3600,
          totalDurationSeconds: null,
          lagExceeded: false,
          lastErrorMessage: null,
          retriedFromPipelineJobId: null,
          retryPipelineJobId: null,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1_200,
      totalPages: 60,
    });

    renderPage();

    expect(await screen.findByText("1h 1m")).toBeInTheDocument();
    expect(screen.getByText("1h")).toBeInTheDocument();
    expect(screen.getByText("총 1,200개 job")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Lag threshold"), "0");
    await userEvent.click(screen.getByRole("button", { name: /초기화/ }));
    await userEvent.click(screen.getByRole("button", { name: /조회/ }));

    await waitFor(() => {
      expect(mocks.listAdminPipelineJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({ lagThresholdSeconds: 300 }),
      );
    });
  });
});
