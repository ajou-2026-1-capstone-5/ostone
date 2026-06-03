import { useQuery } from "@tanstack/react-query";

import { customFetch } from "@/shared/api/mutator";

// OpenAPI is not generated for this dashboard read endpoint yet.

export interface WorkspaceDashboardKnowledgePack {
  packId: number;
  packName: string;
  versionId: number;
  versionNo: number;
  publishedAt?: string | null;
  createdAt?: string | null;
  sourcePipelineJobId?: number | null;
}

export interface WorkspaceDashboardLogUpload {
  datasetId: number;
  datasetKey: string;
  datasetName: string;
  datasetStatus: string;
  uploadedAt?: string | null;
}

export interface WorkspaceDashboardGeneration {
  pipelineJobId: number;
  datasetId?: number | null;
  domainPackId?: number | null;
  status: string;
  requestedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastErrorMessage?: string | null;
}

export interface WorkspaceDashboardHealth {
  activeKnowledgePack?: WorkspaceDashboardKnowledgePack | null;
  lastLogUpload?: WorkspaceDashboardLogUpload | null;
  lastKnowledgePackGeneration?: WorkspaceDashboardGeneration | null;
  pendingReviewCount: number;
}

export const workspaceDashboardHealthKeys = {
  all: ["workspace-dashboard-health"] as const,
  detail: (workspaceId: number) => [...workspaceDashboardHealthKeys.all, workspaceId] as const,
};

export function useWorkspaceDashboardHealth(workspaceId: number) {
  return useQuery({
    queryKey: workspaceDashboardHealthKeys.detail(workspaceId),
    queryFn: ({ signal }) =>
      customFetch<WorkspaceDashboardHealth>(
        `/api/v1/workspaces/${workspaceId}/dashboard/knowledge-pack-health`,
        { method: "GET", signal },
      ),
  });
}
