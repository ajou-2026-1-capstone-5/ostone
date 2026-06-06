import { describe, expect, it, vi, beforeEach } from "vitest";

const { getLatestMock } = vi.hoisted(() => ({
  getLatestMock: vi.fn(),
}));

vi.mock(
  "@/shared/api/generated/endpoints/pipeline-job-status-controller/pipeline-job-status-controller",
  () => ({
    getLatest: getLatestMock,
  }),
);

import { getLatestDatasetPipelineJob } from "./pipelineJobStatusApi";

describe("getLatestDatasetPipelineJob", () => {
  beforeEach(() => {
    getLatestMock.mockReset();
  });

  it("requests the latest ingestion job for a dataset", async () => {
    const response = {
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
    };
    getLatestMock.mockResolvedValue(response);

    await expect(getLatestDatasetPipelineJob(1, 42)).resolves.toEqual(response);
    expect(getLatestMock).toHaveBeenCalledWith(1, 42, { jobType: "INGESTION" });
  });

  it("passes through a requested job type", async () => {
    getLatestMock.mockResolvedValue({ pipelineJob: null });

    await getLatestDatasetPipelineJob(2, 15, "DOMAIN_PACK_GENERATION");

    expect(getLatestMock).toHaveBeenCalledWith(2, 15, {
      jobType: "DOMAIN_PACK_GENERATION",
    });
  });
});
