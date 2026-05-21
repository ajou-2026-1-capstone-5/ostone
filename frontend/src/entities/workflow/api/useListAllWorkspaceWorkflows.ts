import { useQueries, useQuery } from "@tanstack/react-query";
import {
  getDomainPack,
  listDomainPacks,
} from "@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller";
import { listWorkflows } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import { unwrapApiResponse } from "@/shared/api/unwrapApiResponse";
import type {
  DomainPackDetailResult,
  DomainPackSummaryResult,
  WorkflowDefinitionSummary,
} from "@/shared/api/generated/zod";

export interface WorkspaceWorkflowEntry {
  packId: number;
  packName: string;
  versionId: number;
  workflowId: number;
  workflowCode: string | null;
  name: string;
  description: string | null;
}

export interface UseListAllWorkspaceWorkflowsResult {
  loading: boolean;
  error: string | null;
  entries: WorkspaceWorkflowEntry[];
}

interface UseListAllWorkspaceWorkflowsParams {
  workspaceId: number | null;
}

function pickLatestVersionId(detail: DomainPackDetailResult | undefined): number | null {
  if (!detail?.versions || detail.versions.length === 0) return null;
  const sorted = [...detail.versions].sort((a, b) => (b.versionNo ?? 0) - (a.versionNo ?? 0));
  return sorted[0]?.versionId ?? null;
}

export function useListAllWorkspaceWorkflows({
  workspaceId,
}: UseListAllWorkspaceWorkflowsParams): UseListAllWorkspaceWorkflowsResult {
  const enabled = workspaceId !== null;
  const wsId = workspaceId ?? 0;

  const packsQuery = useQuery({
    queryKey: ["workspace-workflows", "packs", wsId] as const,
    queryFn: async ({ signal }) => listDomainPacks(wsId, { signal }),
    enabled,
  });

  const packs = (unwrapApiResponse<DomainPackSummaryResult[]>(packsQuery.data) ?? []).filter(
    (p): p is DomainPackSummaryResult & { packId: number } => typeof p.packId === "number",
  );

  const detailQueries = useQueries({
    queries: packs.map((pack) => ({
      queryKey: ["workspace-workflows", "pack-detail", wsId, pack.packId] as const,
      queryFn: async ({ signal }: { signal?: AbortSignal }) =>
        getDomainPack(wsId, pack.packId, { signal }),
      enabled,
    })),
  });

  const packVersionPairs = packs.map((pack, idx) => {
    const detail = unwrapApiResponse<DomainPackDetailResult>(detailQueries[idx]?.data);
    return { pack, versionId: pickLatestVersionId(detail) };
  });

  const workflowQueries = useQueries({
    queries: packVersionPairs.map((pair) => ({
      queryKey: [
        "workspace-workflows",
        "workflows",
        wsId,
        pair.pack.packId,
        pair.versionId ?? 0,
      ] as const,
      queryFn: async ({ signal }: { signal?: AbortSignal }) =>
        pair.versionId !== null
          ? listWorkflows(wsId, pair.pack.packId!, pair.versionId, { signal })
          : Promise.resolve(undefined as never),
      enabled: enabled && pair.versionId !== null,
    })),
  });

  const loading =
    packsQuery.isLoading ||
    detailQueries.some((q) => q.isLoading) ||
    workflowQueries.some((q) => q.isLoading);

  let error: string | null = null;
  if (packsQuery.isError) {
    error = "도메인팩 목록 조회 실패";
  } else if (detailQueries.find((q) => q.isError)) {
    error = "도메인팩 상세 조회 실패";
  } else if (workflowQueries.find((q) => q.isError)) {
    error = "워크플로우 목록 조회 실패";
  }

  const entries: WorkspaceWorkflowEntry[] = [];
  packVersionPairs.forEach((pair, idx) => {
    if (pair.versionId === null) return;
    const wfList = unwrapApiResponse<WorkflowDefinitionSummary[]>(workflowQueries[idx]?.data) ?? [];
    wfList.forEach((wf) => {
      if (typeof wf.id !== "number") return;
      entries.push({
        packId: pair.pack.packId!,
        packName: pair.pack.name || `pack-${pair.pack.packId}`,
        versionId: pair.versionId!,
        workflowId: wf.id,
        workflowCode: wf.workflowCode ?? null,
        name: wf.name || wf.workflowCode || `wf-${wf.id}`,
        description: wf.description ?? null,
      });
    });
  });

  return { loading, error, entries };
}
