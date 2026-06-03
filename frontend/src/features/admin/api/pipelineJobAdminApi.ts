import {
  list,
  retry,
} from "@/shared/api/generated/endpoints/admin-pipeline-job-controller/admin-pipeline-job-controller";
import type { ListParams } from "@/shared/api/generated/zod";
import { requireApiData } from "@/shared/api";

export interface AdminPipelineJobListFilters {
  status?: string;
  workspaceId?: string;
  dagId?: string;
  runId?: string;
  page?: number;
  size?: number;
  lagThresholdSeconds?: number;
}

export interface AdminPipelineJobItem {
  pipelineJobId: number;
  workspaceId: number;
  datasetId: number | null;
  domainPackId: number | null;
  jobType: string;
  status: string;
  airflowDagId: string | null;
  airflowRunId: string | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  queueLagSeconds: number | null;
  runningDurationSeconds: number | null;
  totalDurationSeconds: number | null;
  lagExceeded: boolean;
  lastErrorMessage: string | null;
  retriedFromPipelineJobId: number | null;
  retryPipelineJobId: number | null;
}

export interface AdminPipelineJobListResponse {
  items: AdminPipelineJobItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface RetryAdminPipelineJobResponse {
  sourcePipelineJobId: number;
  retryPipelineJobId: number;
  workspaceId: number;
  datasetId: number;
  jobType: string;
  status: string;
  airflowDagId: string | null;
  airflowRunId: string | null;
  requestedAt: string;
  startedAt: string | null;
}

export const adminPipelineJobKeys = {
  all: ["admin", "pipeline-jobs"] as const,
  list: (filters: AdminPipelineJobListFilters) =>
    [...adminPipelineJobKeys.all, "list", filters] as const,
};

export async function listAdminPipelineJobs(
  filters: AdminPipelineJobListFilters,
): Promise<AdminPipelineJobListResponse> {
  const response = await list(toListParams(filters));
  return requireApiData<AdminPipelineJobListResponse>(
    response as { data?: AdminPipelineJobListResponse },
    "Pipeline job 목록 응답을 확인할 수 없습니다.",
  );
}

export async function retryAdminPipelineJob(
  pipelineJobId: number,
): Promise<RetryAdminPipelineJobResponse> {
  const response = await retry(pipelineJobId);
  return requireApiData<RetryAdminPipelineJobResponse>(
    response as { data?: RetryAdminPipelineJobResponse },
    "Pipeline job 재시도 응답을 확인할 수 없습니다.",
  );
}

function toListParams(filters: AdminPipelineJobListFilters): ListParams {
  return {
    status: filters.status,
    workspaceId: toNumber(filters.workspaceId),
    dagId: filters.dagId,
    runId: filters.runId,
    page: filters.page,
    size: filters.size,
    lagThresholdSeconds: filters.lagThresholdSeconds,
  };
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
