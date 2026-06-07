import { useQuery } from "@tanstack/react-query";
import {
  getLatestDatasetPipelineJob,
  type LatestPipelineJob,
} from "../api/pipelineJobStatusApi";

const FINAL_PIPELINE_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

const REVIEW_REQUIRED_PIPELINE_STATUSES = new Set([
  "WAITING_DOMAIN_CONFIRMATION",
  "WAITING_HUMAN_FEEDBACK",
]);

export type PipelineJobViewState =
  | "uploaded"
  | "status_unavailable"
  | "pipeline_pending"
  | "running"
  | "review_required"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface PipelineJobQueryState {
  readonly isLoading: boolean;
  readonly isError: boolean;
}

export function derivePipelineJobViewState(
  queryState: PipelineJobQueryState,
  job: LatestPipelineJob | null,
): PipelineJobViewState {
  if (queryState.isLoading) {
    return "uploaded";
  }
  if (queryState.isError) {
    return "status_unavailable";
  }
  if (!job || job.status === "QUEUED") {
    return "pipeline_pending";
  }
  if (REVIEW_REQUIRED_PIPELINE_STATUSES.has(job.status)) {
    return "review_required";
  }
  if (job.status === "SUCCEEDED") {
    return "succeeded";
  }
  if (job.status === "FAILED") {
    return "failed";
  }
  if (job.status === "CANCELLED") {
    return "cancelled";
  }
  return "running";
}

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
