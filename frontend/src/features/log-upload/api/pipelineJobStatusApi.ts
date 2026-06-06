import { selectApiData } from "@/shared/api";
import { getLatest } from "@/shared/api/generated/endpoints/pipeline-job-status-controller/pipeline-job-status-controller";

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

export async function getLatestDatasetPipelineJob(
  workspaceId: number,
  datasetId: number,
  jobType = "INGESTION",
): Promise<LatestPipelineJobResponse> {
  const response = await getLatest(workspaceId, datasetId, { jobType });
  return (
    selectApiData<LatestPipelineJobResponse>(
      response as unknown as LatestPipelineJobResponse | {
        data?: LatestPipelineJobResponse;
      },
    ) ?? { pipelineJob: null }
  );
}
