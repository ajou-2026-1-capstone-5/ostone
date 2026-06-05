import { apiClient } from "@/shared/api";

export interface LatestPipelineJob {
  readonly pipelineJobId: number;
  readonly workspaceId: number;
  readonly datasetId: number;
  readonly domainPackId: number | null;
  readonly jobType: string;
  readonly status: string;
  readonly airflowDagId: string | null;
  readonly airflowRunId: string | null;
  readonly requestedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly runningDurationSeconds: number | null;
  readonly lastErrorMessage: string | null;
}

export interface LatestPipelineJobResponse {
  readonly pipelineJob: LatestPipelineJob | null;
}

export function getLatestDatasetPipelineJob(
  workspaceId: number,
  datasetId: number,
  jobType = "INGESTION",
): Promise<LatestPipelineJobResponse> {
  // OpenAPI-ungenerated
  const params = new URLSearchParams({ jobType });
  return apiClient.get<LatestPipelineJobResponse>(
    `/workspaces/${workspaceId}/datasets/${datasetId}/pipeline-jobs/latest?${params.toString()}`,
  );
}
