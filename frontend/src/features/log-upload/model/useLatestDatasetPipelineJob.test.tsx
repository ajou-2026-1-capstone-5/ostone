import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { LatestPipelineJob } from "../api/pipelineJobStatusApi";

vi.mock("../api/pipelineJobStatusApi", async () => {
  const actual = await vi.importActual<
    typeof import("../api/pipelineJobStatusApi")
  >("../api/pipelineJobStatusApi");
  return {
    ...actual,
    getLatestDatasetPipelineJob: vi.fn(),
  };
});

import { getLatestDatasetPipelineJob } from "../api/pipelineJobStatusApi";
import {
  derivePipelineJobViewState,
  latestDatasetPipelineJobKeys,
  shouldPollPipelineJob,
  useLatestDatasetPipelineJob,
} from "./useLatestDatasetPipelineJob";

const mockGetLatestDatasetPipelineJob = vi.mocked(getLatestDatasetPipelineJob);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const runningJob: LatestPipelineJob = {
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
};

describe("useLatestDatasetPipelineJob", () => {
  beforeEach(() => {
    mockGetLatestDatasetPipelineJob.mockReset();
  });

  it("uses a stable query key", () => {
    expect(latestDatasetPipelineJobKeys.latest(1, 42)).toEqual([
      "dataset-pipeline-job",
      "latest",
      1,
      42,
      "INGESTION",
    ]);
  });

  it("fetches the latest dataset pipeline job when ids exist", async () => {
    mockGetLatestDatasetPipelineJob.mockResolvedValue({
      pipelineJob: runningJob,
    });

    const { result } = renderHook(
      () => useLatestDatasetPipelineJob(1, 42, "INGESTION"),
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(result.current.data?.pipelineJob).toEqual(runningJob),
    );
    expect(mockGetLatestDatasetPipelineJob).toHaveBeenCalledWith(
      1,
      42,
      "INGESTION",
    );
  });

  it("does not fetch before workspace and dataset ids are ready", () => {
    renderHook(() => useLatestDatasetPipelineJob(undefined, null), {
      wrapper: createWrapper(),
    });

    expect(mockGetLatestDatasetPipelineJob).not.toHaveBeenCalled();
  });

  it("keeps polling while no job or a non-final job is present", () => {
    expect(shouldPollPipelineJob(null)).toBe(true);
    expect(shouldPollPipelineJob(runningJob)).toBe(true);
    expect(shouldPollPipelineJob({ ...runningJob, status: "SUCCEEDED" })).toBe(
      false,
    );
    expect(shouldPollPipelineJob({ ...runningJob, status: "FAILED" })).toBe(
      false,
    );
    expect(shouldPollPipelineJob({ ...runningJob, status: "CANCELLED" })).toBe(
      false,
    );
  });
});

describe("derivePipelineJobViewState", () => {
  const settledQuery = { isLoading: false, isError: false };

  it("조회 중에는 uploaded 상태로 둔다", () => {
    expect(
      derivePipelineJobViewState({ isLoading: true, isError: false }, null),
    ).toBe("uploaded");
  });

  it("조회 실패는 status_unavailable로 구분한다", () => {
    expect(
      derivePipelineJobViewState({ isLoading: false, isError: true }, null),
    ).toBe("status_unavailable");
  });

  it("job이 없거나 QUEUED면 pipeline_pending이다", () => {
    expect(derivePipelineJobViewState(settledQuery, null)).toBe(
      "pipeline_pending",
    );
    expect(
      derivePipelineJobViewState(settledQuery, {
        ...runningJob,
        status: "QUEUED",
      }),
    ).toBe("pipeline_pending");
  });

  it("검토 입력 대기 상태는 review_required로 묶는다", () => {
    expect(
      derivePipelineJobViewState(settledQuery, {
        ...runningJob,
        status: "WAITING_DOMAIN_CONFIRMATION",
      }),
    ).toBe("review_required");
    expect(
      derivePipelineJobViewState(settledQuery, {
        ...runningJob,
        status: "WAITING_HUMAN_FEEDBACK",
      }),
    ).toBe("review_required");
  });

  it("종료 상태는 succeeded/failed/cancelled로 구분한다", () => {
    expect(
      derivePipelineJobViewState(settledQuery, {
        ...runningJob,
        status: "SUCCEEDED",
      }),
    ).toBe("succeeded");
    expect(
      derivePipelineJobViewState(settledQuery, {
        ...runningJob,
        status: "FAILED",
      }),
    ).toBe("failed");
    expect(
      derivePipelineJobViewState(settledQuery, {
        ...runningJob,
        status: "CANCELLED",
      }),
    ).toBe("cancelled");
  });

  it("실행과 내부 콜백 대기, 미지정 상태는 running으로 본다", () => {
    expect(derivePipelineJobViewState(settledQuery, runningJob)).toBe(
      "running",
    );
    expect(
      derivePipelineJobViewState(settledQuery, {
        ...runningJob,
        status: "WAITING_INTENT_CALLBACK",
      }),
    ).toBe("running");
    expect(
      derivePipelineJobViewState(settledQuery, {
        ...runningJob,
        status: "WAITING_WORKFLOW_CALLBACK",
      }),
    ).toBe("running");
    expect(
      derivePipelineJobViewState(settledQuery, {
        ...runningJob,
        status: "UNKNOWN_FUTURE_STATUS",
      }),
    ).toBe("running");
  });
});
