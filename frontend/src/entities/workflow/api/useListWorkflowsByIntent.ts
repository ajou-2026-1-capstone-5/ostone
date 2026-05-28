import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getDomainPack } from "@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller";
import { listWorkflows } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import type { DomainPackDetailResult, WorkflowDefinitionSummary } from "@/shared/api/generated/zod";
import { unwrapApiResponse } from "@/shared/api/unwrapApiResponse";

import type { WorkspaceWorkflowEntry } from "./useListAllWorkspaceWorkflows";

export interface UseListWorkflowsByIntentParams {
  workspaceId: number | null;
  packId: number | null;
  versionId: number | null;
  intentDefinitionId: number | null;
}

export interface UseListWorkflowsByIntentResult {
  loading: boolean;
  error: string | null;
  entries: WorkspaceWorkflowEntry[];
}

function toEntry(
  wf: WorkflowDefinitionSummary,
  packId: number,
  packName: string,
  versionId: number,
): WorkspaceWorkflowEntry | null {
  if (typeof wf.id !== "number") return null;
  return {
    packId,
    packName,
    versionId,
    workflowId: wf.id,
    workflowCode: wf.workflowCode ?? null,
    name: wf.name || wf.workflowCode || `wf-${wf.id}`,
    description: wf.description ?? null,
    intentDefinitionId: wf.intentDefinitionId ?? null,
  };
}

export function useListWorkflowsByIntent({
  workspaceId,
  packId,
  versionId,
  intentDefinitionId,
}: UseListWorkflowsByIntentParams): UseListWorkflowsByIntentResult {
  const enabled =
    workspaceId !== null &&
    packId !== null &&
    versionId !== null &&
    intentDefinitionId !== null &&
    intentDefinitionId > 0;

  const packQuery = useQuery({
    queryKey: ["workflows-by-intent", "pack-name", workspaceId ?? 0, packId ?? 0] as const,
    queryFn: async ({ signal }) => getDomainPack(workspaceId!, packId!, { signal }),
    enabled,
  });

  const workflowsQuery: UseQueryResult<WorkflowDefinitionSummary[]> = useQuery({
    queryKey: [
      "workflows-by-intent",
      "list",
      workspaceId ?? 0,
      packId ?? 0,
      versionId ?? 0,
      intentDefinitionId ?? 0,
    ] as const,
    queryFn: async ({ signal }) => {
      const res = await listWorkflows(
        workspaceId!,
        packId!,
        versionId!,
        { intentDefinitionId: intentDefinitionId! },
        { signal },
      );
      return (unwrapApiResponse(res) ?? []) as WorkflowDefinitionSummary[];
    },
    enabled,
  });

  const packName =
    unwrapApiResponse<DomainPackDetailResult>(packQuery.data)?.name ?? `pack-${packId ?? "?"}`;

  const entries: WorkspaceWorkflowEntry[] = (workflowsQuery.data ?? [])
    .map((wf) => toEntry(wf, packId ?? 0, packName, versionId ?? 0))
    .filter((entry): entry is WorkspaceWorkflowEntry => entry !== null);

  const loading = enabled && (packQuery.isLoading || workflowsQuery.isLoading);
  const error = workflowsQuery.isError
    ? "워크플로우 목록 조회 실패"
    : packQuery.isError
      ? "도메인팩 정보 조회 실패"
      : null;

  return { loading, error, entries };
}
