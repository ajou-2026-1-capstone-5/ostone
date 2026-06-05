import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/shared/api", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from "@/shared/api";
import { getLatestDatasetPipelineJob } from "./pipelineJobStatusApi";

const mockGet = vi.mocked(apiClient.get);

describe("getLatestDatasetPipelineJob", () => {
  beforeEach(() => {
    mockGet.mockReset();
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
    mockGet.mockResolvedValue(response);

    await expect(getLatestDatasetPipelineJob(1, 42)).resolves.toEqual(response);
    expect(mockGet).toHaveBeenCalledWith(
      "/workspaces/1/datasets/42/pipeline-jobs/latest?jobType=INGESTION",
    );
  });

  it("passes through a requested job type", async () => {
    mockGet.mockResolvedValue({ pipelineJob: null });

    await getLatestDatasetPipelineJob(2, 15, "DOMAIN_PACK_GENERATION");

    expect(mockGet).toHaveBeenCalledWith(
      "/workspaces/2/datasets/15/pipeline-jobs/latest?jobType=DOMAIN_PACK_GENERATION",
    );
  });
});
