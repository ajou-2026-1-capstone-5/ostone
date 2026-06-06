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
