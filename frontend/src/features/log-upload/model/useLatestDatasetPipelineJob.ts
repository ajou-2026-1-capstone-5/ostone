import { useQuery } from "@tanstack/react-query";
import {
  getLatestDatasetPipelineJob,
  type LatestPipelineJob,
} from "../api/pipelineJobStatusApi";

const FINAL_PIPELINE_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

export const latestDatasetPipelineJobKeys = {
  all: ["dataset-pipeline-job"] as const,
  latest: (workspaceId?: number, datasetId?: number, jobType = "INGESTION") =>
    [
      ...latestDatasetPipelineJobKeys.all,
      "latest",
      workspaceId,
      datasetId,
      jobType,
    ] as const,
};

export function useLatestDatasetPipelineJob(
  workspaceId?: number,
  datasetId?: number | null,
  jobType = "INGESTION",
) {
  return useQuery({
    queryKey: latestDatasetPipelineJobKeys.latest(
      workspaceId,
      datasetId ?? undefined,
      jobType,
    ),
    enabled: workspaceId != null && datasetId != null,
    queryFn: () =>
      getLatestDatasetPipelineJob(
        workspaceId as number,
        datasetId as number,
        jobType,
      ),
    refetchInterval: (query) => {
      const job = query.state.data?.pipelineJob;
      return shouldPollPipelineJob(job) ? 5_000 : false;
    },
  });
}

export function shouldPollPipelineJob(job?: LatestPipelineJob | null): boolean {
  if (!job) {
    return true;
  }
  return !FINAL_PIPELINE_STATUSES.has(job.status);
}
